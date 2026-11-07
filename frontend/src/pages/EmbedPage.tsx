import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { exampleProjects } from '../data/examples'
import { loadExample } from '../utils/loadExample'
import { importVlxFile } from '../utils/vlxFile'
import { EditorPage } from './EditorPage'

type EmbedMessage =
  | { type: 'velxio:load-project'; project: unknown }
  | { type: 'velxio:load-example'; exampleId: string }

function notifyParent(message: Record<string, unknown>) {
  if (window.parent !== window) window.parent.postMessage(message, '*')
}

export function EmbedPage() {
  const [searchParams] = useSearchParams()
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')
  const loadingRef = useRef(false)
  const exampleId = searchParams.get('example')

  useEffect(() => {
    async function loadProject(project: unknown) {
      if (loadingRef.current) return
      loadingRef.current = true
      setError('')
      try {
        const file = new File([JSON.stringify(project)], 'course-project.vlx', {
          type: 'application/json',
        })
        await importVlxFile(file)
        setReady(true)
        notifyParent({ type: 'velxio:loaded' })
      } catch (err) {
        setError(err instanceof Error ? err.message : '加载课程实验失败')
        notifyParent({ type: 'velxio:error', message: String(err) })
      } finally {
        loadingRef.current = false
      }
    }

    async function loadSelectedExample(id: string) {
      const example = exampleProjects.find((item) => item.id === id)
      if (!example) {
        setError(`未找到 Velxio 示例：${id}`)
        notifyParent({ type: 'velxio:error', message: `Unknown example: ${id}` })
        return
      }
      loadingRef.current = true
      try {
        await loadExample(example)
        setReady(true)
        notifyParent({ type: 'velxio:loaded' })
      } catch (err) {
        setError(err instanceof Error ? err.message : '加载示例失败')
        notifyParent({ type: 'velxio:error', message: String(err) })
      } finally {
        loadingRef.current = false
      }
    }

    function handleMessage(event: MessageEvent<EmbedMessage>) {
      if (event.source !== window.parent) return
      const message = event.data
      if (!message || typeof message !== 'object') return
      if (message.type === 'velxio:load-project') {
        void loadProject(message.project)
      } else if (message.type === 'velxio:load-example') {
        void loadSelectedExample(message.exampleId)
      }
    }

    window.addEventListener('message', handleMessage)
    notifyParent({ type: 'velxio:ready' })
    if (exampleId) void loadSelectedExample(exampleId)

    return () => window.removeEventListener('message', handleMessage)
  }, [exampleId])

  if (error) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: 12,
          background: '#0f172a',
          color: '#e2e8f0',
          fontFamily: 'system-ui, sans-serif',
          padding: 24,
          textAlign: 'center',
        }}
      >
        <strong>无法加载 Velxio 实验</strong>
        <span style={{ color: '#94a3b8', fontSize: 13 }}>{error}</span>
      </div>
    )
  }

  if (!ready) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: 12,
          background: '#0f172a',
          color: '#e2e8f0',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: '50%',
            border: '2px solid #334155',
            borderTopColor: '#38bdf8',
            animation: 'spin 0.9s linear infinite',
          }}
        />
        <span style={{ color: '#94a3b8', fontSize: 13 }}>正在加载 Velxio 实验…</span>
        <style>{'@keyframes spin { to { transform: rotate(360deg); } }'}</style>
      </div>
    )
  }

  return <EditorPage />
}
