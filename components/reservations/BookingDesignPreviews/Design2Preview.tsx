import React from 'react';

export const Design2Preview = () => {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: 'linear-gradient(135deg, #0F0F1A, #1A0A1E)',
        borderRadius: 'inherit',
        overflow: 'hidden',
        position: 'relative',
        padding: '8px',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Ambient Glow — Top Right */}
      <div
        style={{
          position: 'absolute',
          top: '-20px',
          right: '-20px',
          width: '70px',
          height: '70px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(244,63,94,0.15) 0%, transparent 70%)',
          filter: 'blur(10px)',
          pointerEvents: 'none',
        }}
      />
      {/* Ambient Glow — Bottom Left */}
      <div
        style={{
          position: 'absolute',
          bottom: '-15px',
          left: '-15px',
          width: '50px',
          height: '50px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(253,164,175,0.1) 0%, transparent 70%)',
          filter: 'blur(8px)',
          pointerEvents: 'none',
        }}
      />

      {/* Compact Header */}
      <div
        style={{
          color: '#F1F1F6',
          fontSize: '9px',
          fontWeight: 'bold',
          textAlign: 'center',
          marginBottom: '4px',
          position: 'relative',
          zIndex: 1,
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
          position: 'relative',
          zIndex: 1,
        }}
      >
        {[1, 2, 3, 4, 5].map((step, i) => (
          <React.Fragment key={step}>
            <div
              style={{
                width: '5px',
                height: '5px',
                borderRadius: '50%',
                background: i === 0 ? '#F43F5E' : 'rgba(241,241,246,0.1)',
                boxShadow: i === 0 ? '0 0 6px rgba(244,63,94,0.5)' : 'none',
                flexShrink: 0,
              }}
            />
            {i < 4 && (
              <div
                style={{
                  width: '6px',
                  height: '1px',
                  background: 'rgba(241,241,246,0.1)',
                  flexShrink: 0,
                }}
              />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Title */}
      <div style={{ textAlign: 'center', marginBottom: '8px', position: 'relative', zIndex: 1 }}>
        <div
          style={{
            color: '#F1F1F6',
            fontSize: '11px',
            fontWeight: 600,
            fontFamily: 'Georgia, serif',
          }}
        >
          Izberite osebo
        </div>
        <div style={{ color: 'rgba(241,241,246,0.6)', fontSize: '7px', marginTop: '1px' }}>
          Kdo naj izvede vašo storitev?
        </div>
      </div>

      {/* MAIN: Kdorkoli Card — large & selected */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          zIndex: 1,
        }}
      >
        <div
          style={{
            background: 'rgba(244,63,94,0.08)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: '2px solid #F43F5E',
            borderRadius: '12px',
            padding: '12px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            boxShadow: '0 8px 24px rgba(244,63,94,0.25)',
            width: 'calc(100% - 8px)',
          }}
        >
          {/* Sparkle Circle */}
          <div
            style={{
              width: '24px',
              height: '24px',
              borderRadius: '50%',
              border: '2px solid #F43F5E',
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
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#F1F1F6' }}>
              Kdorkoli
            </div>
            <div
              style={{
                fontSize: '8px',
                color: 'rgba(241,241,246,0.6)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              Vseeno mi je, kdo me postreže
            </div>
          </div>

          {/* Checkmark Circle */}
          <div
            style={{
              width: '16px',
              height: '16px',
              borderRadius: '50%',
              background: '#F43F5E',
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
