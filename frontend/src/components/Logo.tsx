import './Logo.css';
import logoUrl from '../assets/stellarstech-logo.svg';

interface LogoProps {
  size?: 'small' | 'medium' | 'large';
  showText?: boolean;
}

export default function Logo({ size = 'medium', showText = true }: LogoProps) {
  const sizeClass = `logo-${size}`;

  return (
    <div className={`logo-container ${sizeClass}`}>
      <img className="logo-image" src={logoUrl} alt="Stellars Tech logo" />
      {showText && <span className="logo-text">Stellars Tech</span>}
    </div>
  );
}
