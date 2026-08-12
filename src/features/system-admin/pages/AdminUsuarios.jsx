import { useState } from 'react'
import AppLayout from '../../../components/AppLayout'
import Spinner from '../../../components/Spinner'
import useAdminUsuarios from '../hooks/useAdminUsuarios'
import FiltrosUsuarios from '../components/FiltrosUsuarios'
import TablaUsuarios from '../components/TablaUsuarios'
import ModalUsuario from '../components/ModalUsuario'
import ModalRestablecerPassword from '../components/ModalRestablecerPassword'
import ModalCrearUsuario from '../components/ModalCrearUsuario'
import { mensajeErrorAdmin } from '../api/adminApi'
import '../styles/SystemAdmin.css'

export default function AdminUsuarios() {
  const [filtros, setFiltros] = useState({ search: '', rol: '', activo: '', bloqueado: '', page: 1 })
  const { data, loading, error, reload, setData } = useAdminUsuarios(filtros)
  const [selected, setSelected] = useState(null)
  const [reset, setReset] = useState(null)
  const [creando, setCreando] = useState(false)

  const usuarios = data?.results || []
  const count = data?.count ?? usuarios.length
  const totalPages = data?.totalPages ?? 1

  return (
    <AppLayout mainClass="sa-main app-main-scroll">
      <div className="sa-page">
        <header className="sa-heading">
          <div>
            <h1>Usuarios y accesos</h1>
            <p>{count} usuarios encontrados</p>
          </div>
          <button onClick={() => setCreando(true)}>Dar de alta usuario</button>
        </header>

        <FiltrosUsuarios filtros={filtros} onChange={setFiltros} />

        {error && (
          <div className="sa-error">
            {mensajeErrorAdmin(error)} <button onClick={reload}>Reintentar</button>
          </div>
        )}

        {loading && !usuarios.length ? (
          <Spinner overlay={false} />
        ) : (
          <TablaUsuarios usuarios={usuarios} onVer={setSelected} onReset={setReset} />
        )}

        <nav className="sa-pagination" aria-label="Paginación">
          <button disabled={filtros.page <= 1} onClick={() => setFiltros({ ...filtros, page: filtros.page - 1 })}>Anterior</button>
          <span>Página {filtros.page} de {totalPages}</span>
          <button disabled={filtros.page >= totalPages} onClick={() => setFiltros({ ...filtros, page: filtros.page + 1 })}>Siguiente</button>
        </nav>

        {selected && (
          <ModalUsuario
            usuario={selected}
            onClose={() => setSelected(null)}
            onUpdated={value => {
              setData(prev => ({
                ...prev,
                results: (prev.results || []).map(u => u.autorizacionId === value.autorizacionId ? { ...u, ...value } : u),
              }))
              setSelected(null)
            }}
            onDeleted={usuario => {
              setData(prev => ({
                ...prev,
                count: Math.max(0, (prev.count || 1) - 1),
                results: (prev.results || []).filter(u => u.autorizacionId !== usuario.autorizacionId),
              }))
              setSelected(null)
            }}
          />
        )}
        {reset && <ModalRestablecerPassword usuario={reset} onClose={() => setReset(null)} />}
        {creando && <ModalCrearUsuario onClose={() => setCreando(false)} onCreated={usuario => { setCreando(false); setFiltros({ search: usuario.email, rol: '', activo: '', bloqueado: '', page: 1 }) }} />}
      </div>
    </AppLayout>
  )
}
