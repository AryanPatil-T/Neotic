import React, { useState } from 'react';
import {
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Clapperboard,
  Database,
  Film,
  LayoutDashboard,
  Music,
  Palette,
  Settings,
  Wand2,
} from 'lucide-react';
import { PipelineJob } from '../shared/types';
import { formatBytes } from '../lib/api';

export type NavRoute =
  | 'dashboard'
  | 'generate'
  | 'editors'
  | 'music'
  | 'videos'
  | 'scheduler'
  | 'database'
  | 'settings';

interface LayoutProps {
  activeRoute: NavRoute;
  onNavigate: (route: NavRoute) => void;
  activeProvider: string;
  pipelineJob: PipelineJob | null;
  storageBytes: number;
  children: React.ReactNode;
}

const NAV_ITEMS: Array<{ id: NavRoute; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'generate', label: 'Generate Shorts', icon: Wand2 },
  { id: 'editors', label: 'Visual Editors', icon: Palette },
  { id: 'music', label: 'Music Library', icon: Music },
  { id: 'videos', label: 'My Videos', icon: Film },
  { id: 'scheduler', label: 'Scheduler', icon: CalendarClock },
  { id: 'database', label: 'Excel & Sheets', icon: Database },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export const Layout: React.FC<LayoutProps> = ({
  activeRoute,
  onNavigate,
  activeProvider,
  pipelineJob,
  storageBytes,
  children,
}) => {
  const [collapsed, setCollapsed] = useState(false);

  const activeLabel = NAV_ITEMS.find((n) => n.id === activeRoute)?.label || 'Studio';
  const isRunning = pipelineJob?.status === 'running';
  const progressPct =
    pipelineJob && pipelineJob.totalVideos > 0
      ? Math.round((pipelineJob.completedVideos / pipelineJob.totalVideos) * 100)
      : 0;

  return (
    <div className="min-h-screen bg-[#09090E] text-[#F4F4F6] flex flex-col lg:flex-row">
      {/* Desktop Collapsible Sidebar */}
      <aside
        className={`hidden lg:flex flex-col shrink-0 bg-[#12131A] border-r border-[#27293A] transition-[width] duration-200 ${
          collapsed ? 'w-[74px]' : 'w-[248px]'
        }`}
      >
        <div className="h-16 px-4 flex items-center justify-between border-b border-[#27293A]">
          <button
            onClick={() => onNavigate('dashboard')}
            className="flex items-center gap-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B5CF6] rounded-md"
          >
            <div className="w-8 h-8 rounded-lg bg-[#8B5CF6]/15 border border-[#8B5CF6]/40 flex items-center justify-center shrink-0">
              <Clapperboard className="w-4 h-4 text-[#8B5CF6]" />
            </div>
            {!collapsed && (
              <span className="font-playfair font-semibold text-base tracking-tight text-white whitespace-nowrap">
                AI Shorts Studio
              </span>
            )}
          </button>
          <button
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="p-1.5 rounded-md text-[#8E92A8] hover:text-white hover:bg-[#181924] transition-colors"
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        <nav className="flex-1 py-4 px-2.5 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeRoute === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                title={collapsed ? item.label : undefined}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-[#8B5CF6]/15 text-white border border-[#8B5CF6]/35'
                    : 'text-[#A0A4B8] hover:text-white hover:bg-[#181924] border border-transparent'
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-[#8B5CF6]' : 'text-[#7E8299]'}`} />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </button>
            );
          })}
        </nav>

        {!collapsed && (
          <div className="p-4 border-t border-[#27293A] text-xs text-[#8E92A8] space-y-1">
            <div className="flex items-center justify-between">
              <span>Local SQLite</span>
              <span className="text-[#10B981] font-medium">Ready</span>
            </div>
            <div className="flex items-center justify-between font-mono-tabular">
              <span>Disk Usage</span>
              <span className="text-[#D4D6E2]">{formatBytes(storageBytes)}</span>
            </div>
          </div>
        )}
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 pb-16 lg:pb-0">
        {/* Top Studio Status Bar */}
        <header className="h-16 px-4 sm:px-6 bg-[#12131A]/90 backdrop-blur border-b border-[#27293A] flex items-center justify-between gap-4 sticky top-0 z-30">
          <div className="flex items-center gap-3 min-w-0">
            <span className="lg:hidden font-playfair font-semibold text-base text-white whitespace-nowrap">
              AI Shorts Studio
            </span>
            <span className="hidden lg:inline text-sm font-semibold text-white whitespace-nowrap">
              {activeLabel}
            </span>
            <span className="hidden sm:inline text-[#3D4058]" aria-hidden="true">
              /
            </span>
            <span className="hidden sm:inline text-xs text-[#9B9FB5] truncate font-mono-tabular">
              Engine: {activeProvider.toUpperCase()}
            </span>
          </div>

          <div className="flex items-center gap-5 shrink-0 text-xs">
            {isRunning && pipelineJob ? (
              <button
                onClick={() => onNavigate('dashboard')}
                className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-[#8B5CF6]/15 border border-[#8B5CF6]/40 text-[#E2D9FF] whitespace-nowrap"
              >
                <span className="font-medium">
                  Stage {pipelineJob.currentStageIndex}/12: {pipelineJob.currentStageName}
                </span>
                <span className="font-mono-tabular text-[#8B5CF6]">{progressPct}%</span>
              </button>
            ) : (
              <span className="hidden md:inline text-[#8E92A8] font-mono-tabular whitespace-nowrap">
                Pipeline Idle · Storage {formatBytes(storageBytes)}
              </span>
            )}

            <button
              onClick={() => onNavigate('generate')}
              className="px-3.5 py-2 rounded-lg bg-[#8B5CF6] hover:bg-[#7C3AED] text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
            >
              New Batch
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1440px] w-full mx-auto">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 h-14 bg-[#12131A]/95 backdrop-blur border-t border-[#27293A] flex items-center justify-around px-1 z-40">
        {NAV_ITEMS.slice(0, 6).map((item) => {
          const Icon = item.icon;
          const active = activeRoute === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`flex flex-col items-center justify-center gap-0.5 px-2 py-1 rounded-md min-w-[44px] ${
                active ? 'text-[#8B5CF6]' : 'text-[#8E92A8]'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="text-[10px] leading-tight whitespace-nowrap">
                {item.label.split(' ')[0]}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};
