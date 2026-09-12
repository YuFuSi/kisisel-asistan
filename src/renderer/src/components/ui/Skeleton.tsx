interface SkeletonProps {
  className?: string
}

// Veri yüklenirken gösterilen gri blok
function Skeleton({ className = '' }: SkeletonProps): React.JSX.Element {
  return <div className={`animate-pulse rounded-md bg-elevated ${className}`} />
}

export default Skeleton
