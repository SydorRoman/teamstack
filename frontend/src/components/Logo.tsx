import './Logo.css';

interface LogoProps {
  size?: 'small' | 'medium' | 'large';
  showText?: boolean;
}

export default function Logo({ size = 'medium', showText = true }: LogoProps) {
  const sizeClass = `logo-${size}`;

  return (
    <div className={`logo-container ${sizeClass}`}>
      <svg
        className="logo-svg"
        viewBox="0 0 120 100"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Left triangle (bottom left) */}
        <polygon
          points="10,100 10,40 50,40"
          fill="#9b59b6"
          className="logo-triangle"
        />
        {/* Right triangle (bottom right) */}
        <polygon
          points="70,40 110,40 110,100"
          fill="#9b59b6"
          className="logo-triangle"
        />
        {/* Inverted center triangle (top center, pointing down) */}
        <polygon
          points="50,0 70,0 60,40"
          fill="#9b59b6"
          className="logo-triangle"
        />
      </svg>
      {showText && <span className="logo-text">StellarTech</span>}
    </div>
  );
}
