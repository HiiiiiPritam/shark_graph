import ControlsPanel from '@/components/virtual/Controls';
import NodeCanvas from '@/components/virtual/NodeCanvas';
// import dynamic from 'next/dynamic';

export default function HomePage() {
  return (
    <div>
      <ControlsPanel />
      <NodeCanvas />
    </div>
  );
}