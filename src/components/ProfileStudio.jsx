import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { createProfileMarkdown, profileAvatar, profileBanner, safeUsername } from '../lib/profile'

const INITIAL = {
  username: '', name: '', role: 'Creative developer', bio: '', project: '', projectUrl: '', links: '',
  avatarUrl: '', bannerUrl: '', stack: 'React, Three.js, Motion', style: 'prism', showStats: true
}

const SKINS = [
  { value: 'prism', label: 'Prism', note: '3D + glass', colors: ['#73f2ff', '#876cff', '#b4ff7a'] },
  { value: 'editorial', label: 'Editorial', note: 'Claro + preciso', colors: ['#f2eee7', '#202126', '#ff6c4b'] },
  { value: 'terminal', label: 'Terminal', note: 'Código + señal', colors: ['#050b08', '#7dff9b', '#234a32'] }
]

function Field({ label, children, wide = false }) {
  return <label className={wide ? 'profile-field wide' : 'profile-field'}><span>{label}</span>{children}</label>
}

export default function ProfileStudio() {
  const [profile, setProfile] = useState(INITIAL)
  const [copied, setCopied] = useState(false)
  const markdown = useMemo(() => createProfileMarkdown(profile), [profile])
  const username = safeUsername(profile.username)
  const avatar = profileAvatar(profile)
  const banner = profileBanner(profile)
  const stack = profile.stack.split(',').map((item) => item.trim()).filter(Boolean).slice(0, 8)

  function change(event) {
    const { name, value, checked, type } = event.target
    setProfile((current) => ({ ...current, [name]: type === 'checkbox' ? checked : value }))
  }

  async function copy() {
    await navigator.clipboard.writeText(markdown)
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
  }

  function download() {
    const file = new Blob([markdown], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(file)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'README.md'
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <section className="profile-studio">
      <header className="profile-intro">
        <div>
          <p className="eyebrow"><span /> EXTRA TOOL · GITHUB PROFILE</p>
          <h2>Diseñá tu GitHub Profile.<br /><em>Exportalo como README.</em></h2>
          <p>Diseñá una portada viva, probala en tiempo real y exportá un README compatible con GitHub.</p>
        </div>
        <div className="profile-local"><i /> Se procesa en tu navegador</div>
      </header>

      <div className="skin-picker" aria-label="Elegir apariencia">
        {SKINS.map((skin) => (
          <button type="button" key={skin.value} className={`skin-option ${profile.style === skin.value ? 'active' : ''}`}
            onClick={() => setProfile((current) => ({ ...current, style: skin.value }))} aria-pressed={profile.style === skin.value}>
            <span className="skin-colors">{skin.colors.map((color) => <i key={color} style={{ background: color }} />)}</span>
            <strong>{skin.label}</strong><small>{skin.note}</small>
          </button>
        ))}
      </div>

      <div className="profile-layout">
        <form className="profile-form" onSubmit={(event) => event.preventDefault()}>
          <div className="profile-form-heading"><span>01</span><div><strong>Contenido</strong><small>Lo que querés contar</small></div></div>
          <div className="profile-fields">
            <Field label="Usuario de GitHub"><input name="username" value={profile.username} onChange={change} placeholder="octocat" autoComplete="off" /></Field>
            <Field label="Nombre o marca"><input name="name" value={profile.name} onChange={change} placeholder="Axel · SyntaX" /></Field>
            <Field label="Rol / titular" wide><input name="role" value={profile.role} onChange={change} placeholder="Creative developer" /></Field>
            <Field label="Bio" wide><textarea name="bio" value={profile.bio} onChange={change} rows={3} placeholder="Qué construís, qué te mueve y hacia dónde vas." /></Field>
            <Field label="Proyecto destacado"><input name="project" value={profile.project} onChange={change} placeholder="SyntaX" /></Field>
            <Field label="URL del proyecto"><input name="projectUrl" value={profile.projectUrl} onChange={change} placeholder="https://github.com/…" /></Field>
            <Field label="Stack, separado por comas" wide><input name="stack" value={profile.stack} onChange={change} placeholder="React, TypeScript, Three.js" /></Field>
          </div>

          <details className="profile-assets">
            <summary><span>02</span><div><strong>Imágenes y enlaces</strong><small>Opcional · siempre HTTPS</small></div><b>+</b></summary>
            <div className="profile-fields">
              <Field label="Avatar"><input name="avatarUrl" value={profile.avatarUrl} onChange={change} placeholder="https://…/avatar.png" /></Field>
              <Field label="Banner"><input name="bannerUrl" value={profile.bannerUrl} onChange={change} placeholder="https://…/banner.png" /></Field>
              <Field label="Enlaces, uno por línea" wide><textarea name="links" value={profile.links} onChange={change} rows={3} placeholder="[Portfolio](https://ejemplo.com)" /></Field>
            </div>
          </details>

          <label className="profile-toggle"><input type="checkbox" name="showStats" checked={profile.showStats} onChange={change} /><span><strong>Mostrar estadísticas</strong><small>Se activa cuando indicás tu usuario.</small></span></label>
        </form>

        <div className="profile-canvas-shell">
          <div className="profile-canvas-bar"><span><i /> LIVE PREVIEW</span><b>github / README.md</b></div>
          <AnimatePresence mode="wait">
            <motion.article key={profile.style} className={`profile-preview ${profile.style}`}
              initial={{ opacity: 0, scale: 0.985 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.01 }} transition={{ duration: 0.2, ease: 'easeOut' }}>
              <div className={`profile-banner ${banner ? 'has-image' : ''}`}>{banner && <img src={banner} alt="Banner del perfil" />}<span>GITHUB PROFILE / {profile.style.toUpperCase()}</span></div>
              <div className="profile-preview-body">
                <div className="profile-identity">
                  {avatar ? <img className="profile-avatar" src={avatar} alt="Vista previa de avatar" /> : <div className="profile-avatar placeholder">{(profile.name || username || '@').charAt(0).toUpperCase()}</div>}
                  <div><p className="profile-handle">github.com/{username || 'tu-usuario'}</p><h2>{profile.name || username || 'Tu nombre'}</h2></div>
                </div>
                <p className="profile-role">{profile.role || 'Tu rol'}</p>
                <p className="profile-bio">{profile.bio || 'Una bio breve y concreta para que tus proyectos empiecen a hablar antes del primer clic.'}</p>
                {stack.length > 0 && <div className="profile-stack">{stack.map((item) => <span key={item}>{item}</span>)}</div>}
                {profile.project && <div className="profile-project"><span>PROYECTO DESTACADO</span><strong>{profile.project}</strong><i>Explorar ↗</i></div>}
                {profile.showStats && username && <div className="profile-stats"><span><b>42</b> contribuciones</span><span><b>12</b> repos</span><small>Vista representativa</small></div>}
              </div>
            </motion.article>
          </AnimatePresence>
        </div>
      </div>

      <div className="profile-export">
        <div><span className="export-icon">MD</span><div><h3>Tu README está listo</h3><p>Podés copiarlo, descargarlo y seguir editándolo cuando quieras.</p></div></div>
        <div className="kit-output-actions"><button onClick={copy}>{copied ? 'Copiado ✓' : 'Copiar Markdown'}</button><button className="secondary" onClick={download}>Descargar .md</button></div>
      </div>
      <details className="profile-code"><summary>Ver Markdown generado <span>⌄</span></summary><pre className="script">{markdown}</pre></details>
    </section>
  )
}
