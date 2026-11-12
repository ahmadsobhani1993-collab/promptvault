const stars = [
  [4, 8], [12, 4], [19, 17], [28, 7], [36, 12], [45, 5], [53, 19], [63, 8], [72, 15], [84, 5], [94, 12],
  [7, 28], [16, 36], [25, 30], [34, 41], [47, 33], [58, 39], [69, 29], [78, 42], [91, 34],
  [3, 54], [13, 63], [23, 51], [39, 59], [51, 53], [64, 67], [76, 57], [88, 65], [97, 52],
  [8, 77], [19, 88], [31, 74], [44, 83], [57, 78], [71, 91], [82, 76], [93, 86],
  [2, 19], [10, 46], [20, 7], [30, 22], [40, 28], [49, 12], [60, 25], [70, 5], [81, 25], [90, 48],
  [5, 70], [26, 64], [35, 91], [54, 68], [67, 83], [77, 70], [86, 93], [98, 76],
]

export default function HomeCosmosBackground() {
  return (
    <div aria-hidden className="home-cosmos-background pointer-events-none absolute inset-0 overflow-hidden">
      <div className="home-galaxy-clouds absolute inset-0" />
      <svg className="home-page-orbits absolute left-1/2 top-0 h-[760px] w-[min(150vw,1200px)] -translate-x-1/2" viewBox="0 0 1200 760" fill="none">
        <defs>
          <radialGradient id="home-orbit-mask">
            <stop offset="0%" stopColor="white" stopOpacity=".6" />
            <stop offset="72%" stopColor="white" stopOpacity=".4" />
            <stop offset="100%" stopColor="black" stopOpacity="0" />
          </radialGradient>
          <mask id="home-orbit-fade">
            <rect width="1200" height="760" fill="url(#home-orbit-mask)" />
          </mask>
        </defs>
        <g mask="url(#home-orbit-fade)" stroke="rgba(212,175,55,0.12)" strokeWidth="1">
          <ellipse cx="600" cy="210" rx="260" ry="260" />
          <ellipse cx="600" cy="210" rx="380" ry="380" />
          <ellipse cx="600" cy="210" rx="510" ry="510" />
          <ellipse cx="600" cy="210" rx="650" ry="650" />
        </g>
        <g stroke="rgba(243,229,171,0.2)" strokeWidth="1">
          <path d="m88 168 48-55 71 9 44-56m704 439 62-48 59 13 54-66" />
          <path d="m103 172 34-58 70 8m749 395 58-43 60 14" strokeDasharray="1 5" />
        </g>
        <g fill="#F3E5AB">
          <circle cx="88" cy="168" r="2" /><circle cx="136" cy="113" r="2.5" /><circle cx="207" cy="122" r="2" />
          <circle cx="251" cy="66" r="1.5" /><circle cx="797" cy="505" r="1.5" /><circle cx="859" cy="457" r="2" />
          <circle cx="918" cy="470" r="2.5" /><circle cx="972" cy="404" r="1.5" />
        </g>
      </svg>
      {stars.map(([left, top], index) => (
        <span
          key={index}
          className="home-cosmos-star absolute h-[3px] w-[3px] rounded-full bg-[#f7e6b6]"
          style={{ left: `${left}%`, top: `${top}%`, animationDelay: `${(index % 9) * -0.7}s` }}
        />
      ))}
    </div>
  )
}
