import React from 'react';

export const Design1Preview = () => {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: 'linear-gradient(135deg, #7c3aed, #2563eb, #06b6d4)',
        borderRadius: 'inherit',
        overflow: 'hidden',
        position: 'relative',
        padding: '8px',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Compact Header */}
      <div
        style={{
          color: 'white',
          fontSize: '9px',
          fontWeight: 'bold',
          textAlign: 'center',
          marginBottom: '4px',
        }}
      >
        Salon Demo
      </div>

      {/* Compact Stepper */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '2px',
          marginBottom: '6px',
        }}
      >
        {[1, 2, 3, 4, 5].map((step, i) => (
          <React.Fragment key={step}>
            <div
              style={{
                width: '5px',
                height: '5px',
                borderRadius: '50%',
                background: i === 0 ? '#8b5cf6' : 'rgba(255,255,255,0.3)',
                boxShadow: i === 0 ? '0 0 4px rgba(139,92,246,0.6)' : 'none',
                flexShrink: 0,
              }}
            />
            {i < 4 && (
              <div
                style={{
                  width: '6px',
                  height: '1px',
                  background: 'rgba(255,255,255,0.2)',
                  flexShrink: 0,
                }}
              />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Title */}
      <div style={{ textAlign: 'center', marginBottom: '8px' }}>
        <div style={{ color: 'white', fontSize: '11px', fontWeight: 'bold' }}>
          Izberite osebo
        </div>
        <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '7px', marginTop: '1px' }}>
          Kdo naj vas postreže?
        </div>
      </div>

      {/* MAIN: Kdorkoli Card — large & selected */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            background: 'rgba(255,255,255,0.92)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            borderRadius: '12px',
            padding: '12px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            outline: '3px solid #8b5cf6',
            boxShadow: '0 0 20px rgba(139,92,246,0.35)',
            width: 'calc(100% - 8px)',
          }}
        >
          {/* Sparkle Circle */}
          <div
            style={{
              width: '24px',
              height: '24px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #8b5cf6, #06b6d4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '11px',
              flexShrink: 0,
            }}
          >
            ✨
          </div>

          {/* Text */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#1f2937' }}>
              Kdorkoli
            </div>
            <div style={{ fontSize: '8px', color: '#8b5cf6', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              Vseeno mi je, kdo me postreže
            </div>
          </div>

          {/* Checkmark Circle */}
          <div
            style={{
              width: '16px',
              height: '16px',
              borderRadius: '50%',
              background: '#8b5cf6',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5">
              <polyline points="20,6 9,17 4,12" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
};
