import React from "react";
import type { AbilityType, WeaponType } from "@shared/types";

export const ReticleLogoSVG: React.FC<{ className?: string }> = ({
  className = "h-7 w-7",
}) => (
  <svg
    viewBox="0 0 32 32"
    fill="none"
    className={className}
    aria-hidden="true"
  >
    <circle
      cx="16"
      cy="16"
      r="11"
      stroke="currentColor"
      strokeWidth="2.2"
      className="text-slate-300"
    />
    <path
      d="M16 2v5M16 25v5M2 16h5M25 16h5"
      stroke="#F59E0B"
      strokeWidth="2.4"
      strokeLinecap="round"
    />
    <circle cx="16" cy="16" r="2.6" fill="#F59E0B" />
  </svg>
);

/**
 * Vista superior SVG del operador circular estilo top-down:
 * cuerpo con contorno negro grueso, relleno con el color elegido y dos manitas sosteniendo el rifle inicial.
 */
export const OperatorTopDownSVG: React.FC<{
  color: string;
  size?: number;
  withWeapon?: boolean;
}> = ({ color, size = 112, withWeapon = true }) => (
  <svg
    width={size}
    height={size}
    viewBox="-58 -48 124 96"
    fill="none"
    aria-hidden="true"
  >
    {/* Sombra de suelo */}
    <ellipse cx="2" cy="5" rx="25" ry="19" fill="#000000" fillOpacity="0.38" />

    {withWeapon && (
      <>
        {/* Línea punteada de puntería táctica */}
        <line
          x1="44"
          y1="2"
          x2="62"
          y2="2"
          stroke="#F59E0B"
          strokeWidth="1.6"
          strokeDasharray="3 3"
          strokeOpacity="0.65"
        />
        {/* Manita izquierda */}
        <circle
          cx="16"
          cy="-11"
          r="7.2"
          fill={color}
          stroke="#020617"
          strokeWidth="3.6"
        />
        {/* Cuerpo del rifle táctico */}
        <rect
          x="11"
          y="-5"
          width="35"
          height="10"
          rx="2.5"
          fill="#1E293B"
          stroke="#020617"
          strokeWidth="3"
        />
        <rect x="21" y="-2.5" width="13" height="5" rx="1.2" fill="#F59E0B" />
        <rect x="44" y="-2.5" width="6" height="5" rx="1" fill="#64748B" />
        {/* Manita derecha */}
        <circle
          cx="26"
          cy="8"
          r="7.2"
          fill={color}
          stroke="#020617"
          strokeWidth="3.6"
        />
      </>
    )}

    {!withWeapon && (
      <>
        <circle
          cx="17"
          cy="-11"
          r="6.8"
          fill={color}
          stroke="#020617"
          strokeWidth="3.4"
        />
        <circle
          cx="17"
          cy="11"
          r="6.8"
          fill={color}
          stroke="#020617"
          strokeWidth="3.4"
        />
      </>
    )}

    {/* Cuerpo circular principal con contorno negro grueso */}
    <circle
      cx="0"
      cy="0"
      r="23"
      fill={color}
      stroke="#020617"
      strokeWidth="4.6"
    />
    {/* Brillo cenital sutil */}
    <circle cx="-6" cy="-6" r="10.5" fill="#FFFFFF" fillOpacity="0.22" />
  </svg>
);

export const AbilityVectorIcon: React.FC<{
  ability: AbilityType;
  className?: string;
}> = ({ ability, className = "h-5 w-5" }) => {
  switch (ability) {
    case "dash":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className}>
          <path
            d="M13 3L4 14h7l-1 7 9-11h-7l1-7z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "energy_shield":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className}>
          <path
            d="M12 3l7 3v6c0 4.5-3 7.8-7 9-4-1.2-7-4.5-7-9V6l7-3z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path
            d="M12 7v10"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            opacity="0.6"
          />
        </svg>
      );
    case "proximity_mine":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className}>
          <circle cx="12" cy="13" r="6" stroke="currentColor" strokeWidth="2" />
          <circle cx="12" cy="13" r="2" fill="currentColor" />
          <path
            d="M12 4v3M5 8l2 2M19 8l-2 2"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      );
    case "smoke_grenade":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className}>
          <path
            d="M7 17a4 4 0 01-.8-7.9A5.5 5.5 0 0116.8 8a4.2 4.2 0 01.7 8.3H7z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path
            d="M9 20h6"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      );
  }
};

export const WeaponSilhouetteSVG: React.FC<{
  weapon: WeaponType;
  className?: string;
}> = ({ weapon, className = "h-7 w-16" }) => {
  switch (weapon) {
    case "shotgun":
      return (
        <svg viewBox="0 0 64 26" fill="none" className={className}>
          <rect x="6" y="8" width="48" height="4.5" rx="1.5" fill="currentColor" />
          <rect x="18" y="12.5" width="24" height="4.5" rx="1.5" fill="#F59E0B" />
          <path d="M6 12.5L2 19h8l4-6.5H6z" fill="currentColor" />
        </svg>
      );
    case "rifle":
      return (
        <svg viewBox="0 0 64 26" fill="none" className={className}>
          <rect x="6" y="8" width="49" height="5.5" rx="1.5" fill="currentColor" />
          <rect x="20" y="4.5" width="14" height="3" rx="1" fill="#0EA5E9" />
          <rect x="26" y="13.5" width="6" height="8.5" rx="1" fill="currentColor" />
          <path d="M6 13.5L3 19.5h7l3-6H6z" fill="currentColor" />
        </svg>
      );
    case "sniper":
      return (
        <svg viewBox="0 0 64 26" fill="none" className={className}>
          <rect x="3" y="10" width="58" height="4" rx="1.2" fill="currentColor" />
          <rect x="19" y="5" width="18" height="3.8" rx="1.5" fill="#EF4444" />
          <rect x="20" y="14" width="5.5" height="7.5" rx="1" fill="currentColor" />
        </svg>
      );
    case "impulse_gun":
      return (
        <svg viewBox="0 0 64 26" fill="none" className={className}>
          <rect x="10" y="7" width="32" height="10" rx="4" fill="currentColor" />
          <path
            d="M45 6a9 9 0 010 12M50 3.5a13 13 0 010 17"
            stroke="#0EA5E9"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          <rect x="18" y="16" width="6" height="6.5" rx="1" fill="currentColor" />
        </svg>
      );
    case "flamethrower":
      return (
        <svg viewBox="0 0 64 26" fill="none" className={className}>
          <rect x="8" y="8" width="38" height="8" rx="3" fill="currentColor" />
          <circle cx="18" cy="19" r="4.5" fill="#F59E0B" />
          <path d="M48 12l11-4-3 4 3 4-11-4z" fill="#F59E0B" />
        </svg>
      );
    case "saw_disc":
      return (
        <svg viewBox="0 0 64 26" fill="none" className={className}>
          <rect x="8" y="9" width="28" height="8" rx="2" fill="currentColor" />
          <circle
            cx="45"
            cy="13"
            r="9"
            fill="#F59E0B"
            stroke="currentColor"
            strokeWidth="2"
          />
          <circle cx="45" cy="13" r="3" fill="#020617" />
        </svg>
      );
    case "bee_cannon":
      return (
        <svg viewBox="0 0 64 26" fill="none" className={className}>
          <ellipse cx="30" cy="13" rx="19" ry="8" fill="#F59E0B" />
          <rect x="23" y="5.5" width="4" height="15" fill="#020617" />
          <rect x="33" y="6" width="4" height="14" fill="#020617" />
          <rect x="48" y="10" width="8" height="6" rx="2" fill="currentColor" />
        </svg>
      );
    case "grappling_hook":
      return (
        <svg viewBox="0 0 64 26" fill="none" className={className}>
          <rect x="8" y="9.5" width="32" height="7" rx="2" fill="currentColor" />
          <path
            d="M40 13h14M47 6l9 7-9 7"
            stroke="#8B5CF6"
            strokeWidth="2.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    default:
      // pistol
      return (
        <svg viewBox="0 0 64 26" fill="none" className={className}>
          <rect x="16" y="7.5" width="28" height="6.5" rx="2" fill="currentColor" />
          <rect x="19" y="13.5" width="6.5" height="8.5" rx="1.2" fill="currentColor" />
          <rect x="39" y="9" width="4" height="3" rx="0.8" fill="#F59E0B" />
        </svg>
      );
  }
};
