import { useState, useEffect } from 'react';
import { useDemo } from '../components/Layout';

interface SetupStatus {
  ai: { configured: boolean }; pixieset: { configured: boolean };
  googleCalendar: { configured: boolean }; stripe: { configured: boolean };
  setupComplete: boolean;
}

export default function Settings() {
  const { demo, toggleDemo } = useDemo();
  const [status, setStatus] = useState<SetupStatus | null>(null);
  const [toggles, setToggles] = useState({ autoReply: true, menuBadge: true, desktopNotif: true, sound: false });

  useEffect(() => {
    if (demo) { setStatus({ ai:{configured:false}, pixieset:{configured:false}, googleCalendar:{configured:false}, stripe:{configured:false}, setupComplete:false }); return; }
    fetch('/api/settings').then(r=>r.json()).then(setStatus).catch(()=>setStatus(null));
  }, [demo]);

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20, maxWidth:480 }}>
      <div>
        <h2 style={{ fontSize:26, fontWeight:800, letterSpacing:'-.5px', margin:0 }}>设置</h2>
        <p style={{ fontSize:14, color:'#86868B', margin:'4px 0 0' }}>配置你的 StudioSage 偏好。</p>
      </div>

      {/* Demo mode toggle */}
      <div style={{ background:'#fff', borderRadius:16, padding:14, boxShadow:'0 1px 3px rgba(0,0,0,.04)' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div>
            <div style={{ fontSize:13, fontWeight:600, letterSpacing:'-.1px' }}>演示模式</div>
            <div style={{ fontSize:11, color:'#86868B' }}>使用示例数据预览 StudioSage 功能</div>
          </div>
          <div className={`toggle-track ${demo?'on':''}`} onClick={toggleDemo} />
        </div>
      </div>

      {/* Plan */}
      <div style={{ background:'linear-gradient(135deg, rgba(0,122,255,.04), rgba(88,86,214,.04))', borderRadius:16, padding:16, boxShadow:'0 1px 3px rgba(0,0,0,.04)', border:'.5px solid rgba(0,122,255,.1)' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
          <div>
            <div style={{ fontSize:14, fontWeight:700, letterSpacing:'-.1px' }}>Pro 助手</div>
            <div style={{ fontSize:12, color:'#86868B' }}>14 天免费试用 · 无需信用卡</div>
          </div>
          <div style={{ textAlign:'right' }}>
            <div style={{ fontSize:22, fontWeight:800, color:'#007AFF', letterSpacing:'-.5px' }}>$10<span style={{fontSize:13,fontWeight:500,color:'#86868B'}}>/月</span></div>
            <div style={{ fontSize:10, color:'#86868B' }}>年付 $96 · $8/月</div>
          </div>
        </div>
        <div style={{ display:'flex', gap:6, flexWrap:'wrap', fontSize:11, color:'#86868B' }}>
          <span>✓ AI 自动分类+回复</span>
          <span>✓ 摄影专用发票</span>
          <span>✓ 客户管线</span>
          <span>✓ 无限消息</span>
        </div>
        <button style={{
          width:'100%', marginTop:10, padding:'10px', borderRadius:14, fontSize:13, fontWeight:700,
          background:'#007AFF', color:'#fff', border:'none', cursor:'pointer', letterSpacing:'-.1px',
        }} onClick={()=>alert('试用模式已激活。连接 Stripe 后升级正式版。')}>
          开始 14 天免费试用
        </button>
      </div>

      {/* AI Auto-Reply */}
      <div style={{ background:'#fff', borderRadius:16, padding:'4px 0', boxShadow:'0 1px 3px rgba(0,0,0,.04)' }}>
        <div style={{ padding:'8px 14px' }}>
          <div style={{ fontSize:10, fontWeight:700, color:'#AEAEB2', textTransform:'uppercase', letterSpacing:'.8px' }}>AI 自动回复</div>
        </div>
        <SettingToggle label="启用自动回复" hint="自动回复常见客户咨询" on={toggles.autoReply} onClick={()=>setToggles({...toggles,autoReply:!toggles.autoReply})} />
      </div>

      {/* Notifications */}
      <div style={{ background:'#fff', borderRadius:16, padding:'4px 0', boxShadow:'0 1px 3px rgba(0,0,0,.04)' }}>
        <div style={{ padding:'8px 14px' }}>
          <div style={{ fontSize:10, fontWeight:700, color:'#AEAEB2', textTransform:'uppercase', letterSpacing:'.8px' }}>通知</div>
        </div>
        <SettingToggle label="菜单栏角标" hint="在菜单栏显示未读数量" on={toggles.menuBadge} onClick={()=>setToggles({...toggles,menuBadge:!toggles.menuBadge})} />
        <SettingToggle label="桌面通知" hint="紧急消息时推送提醒" on={toggles.desktopNotif} onClick={()=>setToggles({...toggles,desktopNotif:!toggles.desktopNotif})} />
        <SettingToggle label="提示音" hint="新消息时播放提示音" on={toggles.sound} onClick={()=>setToggles({...toggles,sound:!toggles.sound})} last />
      </div>

      {/* Connections */}
      <div style={{ background:'#fff', borderRadius:16, padding:'4px 0', boxShadow:'0 1px 3px rgba(0,0,0,.04)' }}>
        <div style={{ padding:'8px 14px' }}>
          <div style={{ fontSize:10, fontWeight:700, color:'#AEAEB2', textTransform:'uppercase', letterSpacing:'.8px' }}>连接工具</div>
        </div>
        <ConnRow label="AI 引擎 (DeepSeek)" configured={status?.ai.configured} />
        <ConnRow label="Stripe 支付" configured={status?.stripe.configured} />
        <ConnRow label="Pixieset 相册" configured={status?.pixieset.configured} />
        <ConnRow label="Google Calendar" configured={status?.googleCalendar.configured} last />
      </div>

      {/* Setup hint */}
      {!status?.setupComplete && (
        <div style={{ background:'rgba(255,149,0,.06)', borderRadius:14, padding:14, border:'.5px solid rgba(255,149,0,.12)' }}>
          <p style={{ fontSize:12, color:'#FF9500', fontWeight:600, margin:0 }}>⚡ 演示模式已启用</p>
          <p style={{ fontSize:12, color:'#86868B', margin:'4px 0 0' }}>数据为示例内容。连接真实工具后自动切换为生产模式。</p>
        </div>
      )}
    </div>
  );
}

function SettingToggle({ label, hint, on, onClick, last }: { label:string; hint:string; on:boolean; onClick:()=>void; last?:boolean }) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 14px', borderBottom: last?'none':'.5px solid rgba(0,0,0,.04)' }} onClick={onClick}>
      <div>
        <div style={{ fontSize:13, fontWeight:600, letterSpacing:'-.1px' }}>{label}</div>
        <div style={{ fontSize:11, color:'#86868B' }}>{hint}</div>
      </div>
      <div className={`toggle-track ${on?'on':''}`} />
    </div>
  );
}

function ConnRow({ label, configured, last }: { label:string; configured?:boolean; last?:boolean }) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 14px', borderBottom: last?'none':'.5px solid rgba(0,0,0,.04)' }}>
      <div style={{ fontSize:13, fontWeight:600, letterSpacing:'-.1px' }}>{label}</div>
      <span style={{ fontSize:12, fontWeight:600, color: configured?'#34C759':'#AEAEB2' }}>
        {configured ? '● 已连接' : '○ 未连接'}
      </span>
    </div>
  );
}
