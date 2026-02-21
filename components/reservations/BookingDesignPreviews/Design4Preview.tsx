import React from 'react';

const SPRING_GREEN = '#66BB6A';

export const Design4Preview = () => {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: '#F9FAFB',
        borderRadius: 'inherit',
        overflow: 'hidden',
        position: 'relative',
        padding: '8px',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Decorative Flowers */}
      <div
        style={{
          position: 'absolute',
          top: '4px',
          right: '8px',
          fontSize: '10px',
          opacity: 0.3,
          pointerEvents: 'none',
          lineHeight: 1,
        }}
      >
        🌸
      </div>
      <div
        style={{
          position: 'absolute',
          bottom: '8px',
          left: '8px',
          fontSize: '8px',
          opacity: 0.25,
          pointerEvents: 'none',
          lineHeight: 1,
        }}
      >
        🌷
      </div>

      {/* Seasonal Badge */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '2px' }}>
        <div
          style={{
            background: `rgba(102,187,106,0.1)`,
            color: SPRING_GREEN,
            fontSize: '6px',
            padding: '2px 6px',
            borderRadius: '10px',
            fontWeight: 500,
          }}
        >
          🌸 Pomlad
        </div>
      </div>

      {/* Compact Header */}
      <div
        style={{
          color: SPRING_GREEN,
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
          marginBottom: '5px',
        }}
      >
        {[1, 2, 3, 4, 5].map((step, i) => (
          <React.Fragment key={step}>
            <div
              style={{
                width: '5px',
                height: '5px',
                borderRadius: '50%',
                background: i === 0 ? SPRING_GREEN : '#E5E7EB',
                boxShadow: i === 0 ? `0 0 4px rgba(102,187,106,0.4)` : 'none',
                flexShrink: 0,
              }}
            />
            {i < 4 && (
              <div
                style={{
                  width: '6px',
                  height: '1px',
                  background: '#E5E7EB',
                  flexShrink: 0,
                }}
              />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Main Card Container */}
      <div
        style={{
          flex: 1,
          background: '#FFFFFF',
          borderRadius: '10px',
          border: '1px solid #F3F4F6',
          boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
          padding: '8px',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Title inside card */}
        <div style={{ textAlign: 'center', marginBottom: '6px' }}>
          <div style={{ color: '#1F2937', fontSize: '10px', fontWeight: 'bold' }}>
            Izberite osebo
          </div>
          <div style={{ color: '#6B7280', fontSize: '6px', marginTop: '1px' }}>
            Kdo naj vas postreže?
          </div>
        </div>

        {/* MAIN: Kdorkoli — selected */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
          <div
            style={{
              border: `2px solid ${SPRING_GREEN}`,
              background: `rgba(102,187,106,0.05)`,
              borderRadius: '8px',
              padding: '10px 12px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: `0 4px 16px rgba(102,187,106,0.15)`,
              width: '100%',
            }}
          >
            {/* Circle with sparkles */}
            <div
              style={{
                width: '22px',
                height: '22px',
                borderRadius: '50%',
                border: `2px solid ${SPRING_GREEN}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '9px',
                flexShrink: 0,
              }}
            >
              ✨
            </div>

            {/* Text */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: '#1F2937' }}>
                Kdorkoli
              </div>
              <div
                style={{
                  fontSize: '7px',
                  color: '#6B7280',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                Katerakoli prosta oseba
              </div>
            </div>

            {/* Radio — selected */}
            <div
              style={{
                width: '14px',
                height: '14px',
                borderRadius: '50%',
                background: SPRING_GREEN,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5">
                <polyline points="20,6 9,17 4,12" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Season indicator */}
      <div
        style={{
          textAlign: 'center',
          color: '#9CA3AF',
          fontSize: '5px',
          marginTop: '3px',
        }}
      >
        Trenutno: Pomlad 🌸
      </div>
    </div>
  );
};
