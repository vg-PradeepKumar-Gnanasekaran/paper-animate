'use client';

import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { motion } from 'framer-motion';
import { AnimationData } from '@/types';
import DoodleOverlay from './DoodleOverlay';
import { easeProgress } from '@/lib/keyframes';

interface GraphRendererProps {
  animationData: AnimationData;
  narration: string;
  animationProgress: number;
  title: string;
  transitionState?: 'entering' | 'active' | 'exiting';
  enableDoodles?: boolean;
}

export default function GraphRenderer({
  animationData,
  narration,
  animationProgress,
  title,
  transitionState = 'active',
  enableDoodles = true,
}: GraphRendererProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const prevStepRef = useRef<number>(-1);
  const containerOpacity = transitionState === 'active' ? 1 : 0.9;
  const containerScale = transitionState === 'entering' ? 0.97 : transitionState === 'exiting' ? 1.02 : 1;

  // Apply easing to progress
  const easedProgress = easeProgress(animationProgress, 'easeInOut');

  // Compute current step index
  const currentStepIndex = animationData?.steps
    ? Math.min(
        Math.floor(easedProgress * animationData.steps.length),
        animationData.steps.length - 1
      )
    : 0;

  useEffect(() => {
    if (!svgRef.current || !animationData?.steps) return;

    // Only rebuild when step index CHANGES (not every progress tick)
    if (currentStepIndex === prevStepRef.current) return;
    prevStepRef.current = currentStepIndex;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = 700;
    const height = 400;
    const margin = { top: 40, right: 40, bottom: 60, left: 60 };

    const g = svg
      .attr('viewBox', `0 0 ${width} ${height}`)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // Palette for rich graph colors
    const palette = ['#818CF8', '#34D399', '#FBBF24', '#F472B6', '#60A5FA', '#A78BFA', '#FB923C'];

    // Only show elements from the CURRENT step (single-step rendering)
    const visibleElements: Array<{
      type: string;
      props: Record<string, unknown>;
      continuous?: string;
    }> = [];

    const currentStep = animationData.steps[currentStepIndex];
    if (currentStep?.elements) {
      currentStep.elements.forEach((el) => {
        visibleElements.push({
          type: el.type,
          props: el.props,
          continuous: el.animation.continuous || 'none',
        });
      });
    }

    // Add gradient definitions
    const defs = svg.append('defs');

    // Add glow filter
    const glowFilter = defs.append('filter').attr('id', 'glow');
    glowFilter.append('feGaussianBlur').attr('stdDeviation', '3').attr('result', 'coloredBlur');
    const feMerge = glowFilter.append('feMerge');
    feMerge.append('feMergeNode').attr('in', 'coloredBlur');
    feMerge.append('feMergeNode').attr('in', 'SourceGraphic');

    // Render nodes
    const nodes = visibleElements.filter((el) => el.type === 'node');
    if (nodes.length > 0) {
      const nodeData = nodes.map((n, i) => ({
        x: (n.props.x as number) || (innerWidth / (nodes.length + 1)) * (i + 1),
        y: (n.props.y as number) || innerHeight / 2,
        label: (n.props.content as string) || `${i}`,
        color: (n.props.color as string) || palette[i % palette.length],
        size: (n.props.size as number) || 22,
      }));

      // Create radial gradients for each node
      nodeData.forEach((d, i) => {
        const grad = defs.append('radialGradient')
          .attr('id', `nodeGrad-${i}`)
          .attr('cx', '35%').attr('cy', '35%');
        grad.append('stop').attr('offset', '0%').attr('stop-color', d3.color(d.color)?.brighter(0.8)?.toString() || d.color);
        grad.append('stop').attr('offset', '100%').attr('stop-color', d.color);
      });

      // Render edges first (behind nodes)
      const edges = visibleElements.filter((el) => el.type === 'edge' || el.type === 'line');
      edges.forEach((edge) => {
        const from = edge.props.from as number;
        const to = edge.props.to as number;
        if (from !== undefined && to !== undefined && nodeData[from] && nodeData[to]) {
          g.append('line')
            .attr('x1', nodeData[from].x)
            .attr('y1', nodeData[from].y)
            .attr('x2', nodeData[to].x)
            .attr('y2', nodeData[to].y)
            .attr('stroke', 'rgba(148, 163, 184, 0.4)')
            .attr('stroke-width', 2)
            .attr('stroke-dasharray', '6,4')
            .attr('opacity', 0)
            .transition()
            .duration(600)
            .ease(d3.easeCubicOut)
            .attr('opacity', 1);
        }
      });

      // Render nodes with gradient fills
      const nodeGroups = g.selectAll('.node')
        .data(nodeData)
        .enter()
        .append('g')
        .attr('class', 'node')
        .attr('transform', (d) => `translate(${d.x},${d.y})`);

      // Outer glow ring
      nodeGroups.append('circle')
        .attr('r', 0)
        .attr('fill', 'none')
        .attr('stroke', (d) => d.color)
        .attr('stroke-width', 1)
        .attr('opacity', 0.3)
        .attr('filter', 'url(#glow)')
        .transition()
        .duration(600)
        .ease(d3.easeBackOut)
        .delay((_, i) => i * 100)
        .attr('r', (d) => d.size + 6);

      // Main node circle with gradient
      nodeGroups.append('circle')
        .attr('r', 0)
        .attr('fill', (_, i) => `url(#nodeGrad-${i})`)
        .attr('stroke', 'rgba(255, 255, 255, 0.2)')
        .attr('stroke-width', 2)
        .transition()
        .duration(600)
        .ease(d3.easeBackOut)
        .delay((_, i) => i * 100)
        .attr('r', (d) => d.size);

      // Node labels
      nodeGroups.append('text')
        .text((d) => d.label)
        .attr('text-anchor', 'middle')
        .attr('dy', '0.35em')
        .attr('fill', 'white')
        .attr('font-size', '12px')
        .attr('font-weight', '700')
        .attr('opacity', 0)
        .transition()
        .duration(400)
        .ease(d3.easeCubicOut)
        .delay((_, i) => i * 100 + 300)
        .attr('opacity', 1);

      // Continuous float animation on node groups
      nodeGroups.each(function(d) {
        const el = d3.select(this);
        function floatLoop() {
          el.transition()
            .duration(1500)
            .ease(d3.easeSinInOut)
            .attr('transform', `translate(${d.x},${d.y - 3})`)
            .transition()
            .duration(1500)
            .ease(d3.easeSinInOut)
            .attr('transform', `translate(${d.x},${d.y + 3})`)
            .on('end', floatLoop);
        }
        floatLoop();
      });
    }

    // Render text elements
    const texts = visibleElements.filter((el) => el.type === 'text');
    texts.forEach((t) => {
      g.append('text')
        .text((t.props.content as string) || '')
        .attr('x', (t.props.x as number) || innerWidth / 2)
        .attr('y', (t.props.y as number) || 30)
        .attr('text-anchor', 'middle')
        .attr('fill', (t.props.color as string) || '#CBD5E1')
        .attr('font-size', `${(t.props.size as number) || 14}px`)
        .attr('font-weight', '500')
        .attr('opacity', 0)
        .transition()
        .duration(600)
        .ease(d3.easeCubicOut)
        .attr('opacity', 1);
    });

    // Render shapes (bars, rectangles) with gradient fills
    const shapes = visibleElements.filter((el) => el.type === 'shape');
    shapes.forEach((s, i) => {
      const shapeColor = (s.props.color as string) || palette[i % palette.length];

      // Create gradient for bar
      const barGrad = defs.append('linearGradient')
        .attr('id', `barGrad-${i}`)
        .attr('x1', '0%').attr('y1', '0%')
        .attr('x2', '0%').attr('y2', '100%');
      barGrad.append('stop').attr('offset', '0%').attr('stop-color', d3.color(shapeColor)?.brighter(0.4)?.toString() || shapeColor);
      barGrad.append('stop').attr('offset', '100%').attr('stop-color', shapeColor);

      const shapeType = (s.props.shape as string) || 'rect';
      if (shapeType === 'rect' || shapeType === 'bar') {
        g.append('rect')
          .attr('x', (s.props.x as number) || i * 60)
          .attr('y', innerHeight)
          .attr('width', (s.props.width as number) || 40)
          .attr('height', 0)
          .attr('fill', `url(#barGrad-${i})`)
          .attr('rx', 6)
          .attr('stroke', 'rgba(255, 255, 255, 0.1)')
          .attr('stroke-width', 1)
          .transition()
          .duration(800)
          .ease(d3.easeCubicOut)
          .delay(i * 100)
          .attr('y', (s.props.y as number) || innerHeight / 2)
          .attr('height', (s.props.height as number) || innerHeight / 2);
      }
    });

    // Render arrows with styled markers
    const arrows = visibleElements.filter((el) => el.type === 'arrow');
    arrows.forEach((a, idx) => {
      const x1 = (a.props.x1 as number) || 0;
      const y1 = (a.props.y1 as number) || 0;
      const x2 = (a.props.x2 as number) || 100;
      const y2 = (a.props.y2 as number) || 0;
      const arrowColor = (a.props.color as string) || '#818CF8';

      // Arrow marker
      defs.append('marker')
        .attr('id', `arrowhead-${idx}`)
        .attr('viewBox', '0 -5 10 10')
        .attr('refX', 8)
        .attr('refY', 0)
        .attr('markerWidth', 6)
        .attr('markerHeight', 6)
        .attr('orient', 'auto')
        .append('path')
        .attr('d', 'M0,-5L10,0L0,5')
        .attr('fill', arrowColor);

      g.append('line')
        .attr('x1', x1)
        .attr('y1', y1)
        .attr('x2', x1)
        .attr('y2', y1)
        .attr('stroke', arrowColor)
        .attr('stroke-width', 2.5)
        .attr('marker-end', `url(#arrowhead-${idx})`)
        .attr('opacity', 0.8)
        .transition()
        .duration(800)
        .ease(d3.easeCubicOut)
        .attr('x2', x2)
        .attr('y2', y2);
    });

    // Render highlight elements
    const highlights = visibleElements.filter((el) => el.type === 'highlight');
    highlights.forEach((h, idx) => {
      const hx = (h.props.x as number) || innerWidth / 2;
      const hy = (h.props.y as number) || innerHeight / 2;
      const hContent = (h.props.content as string) || '';

      // Highlight background
      const textLen = hContent.length * 7 + 24;
      g.append('rect')
        .attr('x', hx - textLen / 2)
        .attr('y', hy - 16)
        .attr('width', textLen)
        .attr('height', 32)
        .attr('rx', 8)
        .attr('fill', 'rgba(251, 191, 36, 0.12)')
        .attr('stroke', 'rgba(251, 191, 36, 0.4)')
        .attr('stroke-width', 1)
        .attr('opacity', 0)
        .transition()
        .duration(600)
        .ease(d3.easeCubicOut)
        .delay(idx * 150)
        .attr('opacity', 1);

      g.append('text')
        .text(hContent)
        .attr('x', hx)
        .attr('y', hy + 5)
        .attr('text-anchor', 'middle')
        .attr('fill', '#FBBF24')
        .attr('font-size', '13px')
        .attr('font-weight', '600')
        .attr('opacity', 0)
        .transition()
        .duration(400)
        .ease(d3.easeCubicOut)
        .delay(idx * 150 + 200)
        .attr('opacity', 1);
    });
  }, [animationData, currentStepIndex]);

  return (
    <div
      className="w-full h-full flex flex-col items-center justify-center relative overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 40%, #1E3A5F 100%)',
        opacity: containerOpacity,
        transform: `scale(${containerScale})`,
        transition: 'opacity 0.45s ease, transform 0.6s ease',
      }}
    >
      {/* Dot grid overlay */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
          backgroundSize: '28px 28px',
        }}
      />

      {/* Glow accents */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-64 rounded-full opacity-15 blur-3xl"
        style={{ background: 'radial-gradient(circle, #60A5FA, transparent)' }}
      />
      <div
        className="absolute bottom-0 right-0 w-72 h-72 rounded-full opacity-10 blur-3xl"
        style={{ background: 'radial-gradient(circle, #34D399, transparent)' }}
      />

      {/* Content */}
      <div className="relative z-10 w-full h-full flex flex-col items-center justify-center px-8 py-6">
        <motion.h3
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-2xl font-bold text-white mb-4 tracking-tight"
        >
          {title}
        </motion.h3>

        <div
          className="w-full max-w-3xl rounded-xl border border-white/10 overflow-hidden backdrop-blur-sm relative"
          style={{
            background: 'rgba(15, 23, 42, 0.5)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
          }}
        >
          <svg
            ref={svgRef}
            className="w-full"
            style={{ maxHeight: '400px' }}
          />
          {enableDoodles && (
            <DoodleOverlay
              currentStep={animationData?.steps?.[currentStepIndex] || null}
              animationProgress={animationProgress}
              width={700}
              height={400}
            />
          )}
        </div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: animationProgress > 0.2 ? 0.7 : 0 }}
          transition={{ duration: 0.8 }}
          className="mt-5 text-slate-400 text-center max-w-lg leading-relaxed text-sm"
        >
          {narration}
        </motion.p>
      </div>
    </div>
  );
}
