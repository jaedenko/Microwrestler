"""Wrestler legs sim. Joints (per side L/R): yaw, thigh=hip pitch, shin=knee, ankle=ankle pitch, foot=ankle roll.
Pitch axes are +X, roll +Y, angles in radians, 0 = neutral (servo 90 deg). Servo direction signs are firmware calibration.
python wrestler.py  -> stand + squat self-check."""
import numpy as np, mujoco, os
XML=os.path.join(os.path.dirname(os.path.abspath(__file__)),'wrestler.xml')

def leg_ik(m,side,dz=0.,dy=0.):
    """Hip/knee/ankle-pitch angles that move the ankle axis by (dy,dz) mm from neutral, foot kept flat. dz>0 = pelvis lower."""
    yz=lambda n:m.body_pos[mujoco.mj_name2id(m,mujoco.mjtObj.mjOBJ_BODY,f'{side}_{n}')][1:]*1e3
    v1,v2=yz('shin'),yz('ankle')                      # hip->knee, knee->ankle (neutral, y,z)
    t=v1+v2+np.array([dy,dz]); a=lambda v:np.arctan2(v[1],v[0])
    r=lambda q,v:np.array([v[0]*np.cos(q)-v[1]*np.sin(q),v[0]*np.sin(q)+v[1]*np.cos(q)])
    c=(t@t-v1@v1-v2@v2)/(2*np.linalg.norm(v1)*np.linalg.norm(v2))
    if abs(c)>1+1e-6: raise ValueError('target out of reach')
    c=np.clip(c,-1,1)
    q2=min((s*np.arccos(c)-(a(v2)-a(v1)) for s in(1,-1)),key=lambda q:abs((q+np.pi)%(2*np.pi)-np.pi))
    q2=(q2+np.pi)%(2*np.pi)-np.pi
    q1=a(t)-a(v1+r(q2,v2))
    return q1,q2,-(q1+q2)

def pose(m,d,side,q):
    for n,v in zip(('thigh','shin','ankle'),q): d.ctrl[m.actuator(f'{side}_{n}').id]=v

def run(m,d,sec):
    for _ in range(int(sec/m.opt.timestep)): mujoco.mj_step(m,d)

if __name__=='__main__':
    m=mujoco.MjModel.from_xml_path(XML); d=mujoco.MjData(m)
    # 1) IK round-trip: forward kinematics of the solved angles must hit the target
    rel=lambda dd:dd.xpos[m.body('L_ankle').id]-dd.xpos[m.body('L_thigh').id]
    d0=mujoco.MjData(m); mujoco.mj_forward(m,d0); n0=rel(d0)*1e3
    for dz in(0,8,15):
        q=leg_ik(m,'L',dz); assert abs(sum(q))<1e-9; dd=mujoco.MjData(m)
        for n,v in zip(('thigh','shin','ankle'),q): dd.qpos[m.joint(f'L_{n}').qposadr[0]]=v
        mujoco.mj_forward(m,dd); err=rel(dd)*1e3-(n0+[0,0,dz]); assert abs(err).max()<1e-3,err   # FK lands on target
    try: leg_ik(m,'L',-5); raise SystemExit('neutral leg is straight: dz<0 must be unreachable')
    except ValueError: pass
    # 2) stand 1 s with all ctrl = 0
    run(m,d,1.0); z0=d.qpos[2]
    assert np.isfinite(d.qpos).all() and d.xmat[m.body('base').id][8]>.99, 'fell over standing'
    # 3) squat 8 mm via IK on both legs
    for s in 'LR': pose(m,d,s,leg_ik(m,s,8.))
    run(m,d,1.5); drop=(z0-d.qpos[2])*1e3
    up=d.xmat[m.body('base').id][8]; flat=min(d.xmat[m.body(f'{s}_foot').id][8] for s in 'LR')
    print(f'stand z={z0*1e3:.1f} mm  squat drop={drop:.1f} mm  base up={up:.3f}  foot flat={flat:.3f}')
    assert 5<drop<9 and up>.99 and flat>.99, 'squat check failed'
    print('OK')
