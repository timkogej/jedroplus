import React from 'react';

export const Design3Preview = () => {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: '#F5F0E8',
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
          color: '#3D2B1F',
          fontSize: '9px',
          fontWeight: 'bold',
          textAlign: 'center',
          fontFamily: 'Georgia, "Times New Roman", serif',
          borderBottom: '1px solid #E8DDD1',
          paddingBottom: '4px',
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
                background: i === 0 ? '#C4956A' : 'transparent',
                border: i === 0 ? 'none' : '1px solid rgba(61,43,31,0.2)',
                flexShrink: 0,
              }}
            />
            {i < 4 && (
              <div
                style={{
                  width: '6px',
                  height: '1px',
                  background: i === 0 ? '#C4956A' : '#E8DDD1',
                  flexShrink: 0,
                }}
              />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Title — two colors */}
      <div style={{ textAlign: 'center', marginBottom: '8px' }}>
        <div style={{ fontSize: '11px', fontFamily: 'Georgia, "Times New Roman", serif' }}>
          <span style={{ color: '#3D2B1F', fontWeight: 600 }}>Izberi </span>
          <span style={{ color: '#C4956A', fontWeight: 600 }}>specialista</span>
        </div>
        <div style={{ color: '#9C8572', fontSize: '7px', marginTop: '1px' }}>
          Izberi osebo, ki te bo postregel/a
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
            background: '#FAF7F2',
            border: '2px solid #C4956A',
            borderRadius: '12px',
            padding: '12px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            boxShadow: '0 4px 16px rgba(196,149,106,0.2)',
            width: 'calc(100% - 8px)',
            position: 'relative',
          }}
        >
          {/* Left Accent Line */}
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: '8px',
              bottom: '8px',
              width: '3px',
              background: '#C4956A',
              borderRadius: '0 2px 2px 0',
            }}
          />

          {/* Avatar Circle */}
          <div
            style={{
              width: '24px',
              height: '24px',
              borderRadius: '50%',
              border: '2px solid #C4956A',
              background: 'rgba(196,149,106,0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '11px',
              flexShrink: 0,
              marginLeft: '4px',
            }}
          >
            👥
          </div>

          {/* Text */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: '12px',
                fontWeight: 600,
                color: '#3D2B1F',
                fontFamily: 'Georgia, "Times New Roman", serif',
              }}
            >
              Kdorkoli prost
            </div>
            <div
              style={{
                fontSize: '8px',
                color: '#9C8572',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              Izberem katerokoli prosto osebo
            </div>
          </div>

          {/* Arrow */}
          <div style={{ color: '#C4956A', fontSize: '16px', flexShrink: 0, lineHeight: 1 }}>
            →
          </div>
        </div>
      </div>
    </div>
  );
};
