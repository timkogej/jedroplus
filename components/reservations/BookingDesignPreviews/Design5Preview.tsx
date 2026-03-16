import React from 'react';

const PRIMARY = '#8B5CF6';

export const Design5Preview = () => {
  const employees = [
    { initials: 'AK', name: 'Ana Kovač', subtitle: 'Frizerka' },
    { initials: 'MN', name: 'Maja Novak', subtitle: 'Stilistka' },
  ];

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
        borderRadius: 'inherit',
        overflow: 'hidden',
        position: 'relative',
        padding: '10px 8px',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'inherit',
      }}
    >
      {/* Ambient glow */}
      <div
        style={{
          position: 'absolute',
          top: '-20px',
          right: '-20px',
          width: '80px',
          height: '80px',
          borderRadius: '50%',
          background: `radial-gradient(circle, ${PRIMARY}30 0%, transparent 70%)`,
          filter: 'blur(12px)',
          pointerEvents: 'none',
        }}
      />

      {/* Title */}
      <div style={{ textAlign: 'center', marginBottom: '8px', position: 'relative', zIndex: 1 }}>
        <div style={{ fontSize: '10px', fontFamily: 'Georgia, serif', fontWeight: 400, color: 'white', letterSpacing: '0.02em' }}>
          Izberi{' '}
          <span style={{ color: PRIMARY }}>specialista</span>
        </div>
        <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '6.5px', marginTop: '1px' }}>
          Izberi osebo, ki te bo postregel/a
        </div>
      </div>

      {/* Glass card */}
      <div
        style={{
          flex: 1,
          background: 'rgba(255,255,255,0.07)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderRadius: '10px',
          border: '1px solid rgba(255,255,255,0.1)',
          overflow: 'hidden',
          position: 'relative',
          zIndex: 1,
        }}
      >
        {/* Kdorkoli — selected */}
        <div
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            gap: '7px',
            padding: '7px 8px 7px 14px',
          }}
        >
          {/* Left accent bar — selected */}
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              width: '2px',
              background: PRIMARY,
              borderRadius: '0 2px 2px 0',
            }}
          />
          {/* Avatar */}
          <div
            style={{
              width: '22px',
              height: '22px',
              borderRadius: '50%',
              background: `${PRIMARY}20`,
              border: `2px solid ${PRIMARY}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              boxShadow: `0 0 8px ${PRIMARY}40`,
            }}
          >
            {/* Users icon */}
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={PRIMARY} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          </div>
          {/* Text */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '9px', fontFamily: 'Georgia, serif', color: PRIMARY, fontWeight: 500 }}>Kdorkoli</div>
            <div style={{ fontSize: '6px', color: 'rgba(255,255,255,0.5)', marginTop: '1px' }}>Izberi najboljši termin zame</div>
          </div>
          {/* Chevron */}
          <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke={PRIMARY} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </div>

        {/* Divider */}
        <div style={{ height: '1px', background: 'rgba(255,255,255,0.08)', marginLeft: '8px' }} />

        {/* Employees */}
        {employees.map((emp, idx) => (
          <React.Fragment key={emp.initials}>
            <div
              style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                gap: '7px',
                padding: '7px 8px 7px 10px',
              }}
            >
              {/* Avatar */}
              <div
                style={{
                  width: '22px',
                  height: '22px',
                  borderRadius: '50%',
                  background: 'rgba(255,255,255,0.08)',
                  border: '1.5px solid rgba(255,255,255,0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  fontSize: '7px',
                  fontWeight: 600,
                  color: 'white',
                }}
              >
                {emp.initials}
              </div>
              {/* Text */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '9px', fontFamily: 'Georgia, serif', color: 'white', fontWeight: 400 }}>{emp.name}</div>
                <div style={{ fontSize: '6px', color: 'rgba(255,255,255,0.5)', marginTop: '1px' }}>{emp.subtitle}</div>
              </div>
            </div>
            {idx < employees.length - 1 && (
              <div style={{ height: '1px', background: 'rgba(255,255,255,0.08)', marginLeft: '8px' }} />
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};
