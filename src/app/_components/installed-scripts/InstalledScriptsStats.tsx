"use client";

interface InstalledScriptsStatsProps {
  total: number;
  runningLxc: number;
  runningVm: number;
  stoppedLxc: number;
  stoppedVm: number;
}

export function InstalledScriptsStats({
  total,
  runningLxc,
  runningVm,
  stoppedLxc,
  stoppedVm,
}: InstalledScriptsStatsProps) {
  return (
    <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-5">
      <div className="bg-info/10 border-info/20 rounded-lg border p-4 text-center">
        <div className="text-info text-2xl font-bold">{total}</div>
        <div className="text-info/80 text-sm">Total Installations</div>
      </div>
      <div className="bg-success/10 border-success/20 rounded-lg border p-4 text-center">
        <div className="text-success text-2xl font-bold">{runningLxc}</div>
        <div className="text-success/80 text-sm">Running LXC</div>
      </div>
      <div className="bg-success/10 border-success/20 rounded-lg border p-4 text-center">
        <div className="text-success text-2xl font-bold">{runningVm}</div>
        <div className="text-success/80 text-sm">Running VMs</div>
      </div>
      <div className="bg-error/10 border-error/20 rounded-lg border p-4 text-center">
        <div className="text-error text-2xl font-bold">{stoppedLxc}</div>
        <div className="text-error/80 text-sm">Stopped LXC</div>
      </div>
      <div className="bg-error/10 border-error/20 rounded-lg border p-4 text-center">
        <div className="text-error text-2xl font-bold">{stoppedVm}</div>
        <div className="text-error/80 text-sm">Stopped VMs</div>
      </div>
    </div>
  );
}
