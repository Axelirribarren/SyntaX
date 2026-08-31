export default function SkillCard({ item, isFav, onToggleFav }) {
  return (
    <div className="card">
      <div className="card-header">
        <a href={item.url} target="_blank" rel="noreferrer" className="card-title">
          {item.name}
        </a>
        <button
          className={`fav-btn ${isFav ? 'active' : ''}`}
          onClick={() => onToggleFav(item)}
          title={isFav ? 'Quitar de favoritos' : 'Guardar'}
        >
          {isFav ? '★' : '☆'}
        </button>
      </div>
      <p className="card-desc">{item.description || 'Sin descripción'}</p>
      <div className="card-meta">
        {item.stars !== null && <span>⭐ {item.stars}</span>}
        <span className="badge">{item.license}</span>
        {item.sourceLabel && <span className="badge source">{item.sourceLabel}</span>}
      </div>
    </div>
  )
}
