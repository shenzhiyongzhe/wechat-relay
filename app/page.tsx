'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface Message {
  id: string;
  name: string;
  end_of_id: string;
  remark: string;
  creator_name: string;
  source: string;
  status: 'pending' | 'submitted';
  created_at: string;
  updated_at: string;
}

interface Toast {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

interface EditForm {
  name: string;
  end_of_id: string;
  remark: string;
  creator_name: string;
}

export default function HomePage() {
  const [messages, setMessages]           = useState<Message[]>([]);
  const [filter, setFilter]               = useState<'all' | 'pending' | 'submitted'>('all');
  const [selected, setSelected]           = useState<Set<string>>(new Set());
  const [loading, setLoading]             = useState(true);
  const [submitting, setSubmitting]       = useState(false);
  const [editTarget, setEditTarget]       = useState<Message | null>(null);
  const [editForm, setEditForm]           = useState<EditForm>({ name: '', end_of_id: '', remark: '', creator_name: '' });
  const [toasts, setToasts]               = useState<Toast[]>([]);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [batchDeleteConfirm, setBatchDeleteConfirm] = useState(false);
  const [batchDeleting, setBatchDeleting] = useState(false);
  const intervalRef                       = useRef<ReturnType<typeof setInterval> | null>(null);
  const fetchMessagesRef                  = useRef<((silent?: boolean) => Promise<void>) | null>(null);

  /* ── Toast ── */
  const addToast = useCallback((type: Toast['type'], message: string) => {
    const id = Math.random().toString(36).slice(2);
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
  }, []);

  /* ── Fetch ── */
  const fetchMessages = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res  = await fetch('/api/messages');
      const data = await res.json();
      if (data.success) setMessages(data.data);
    } catch {
      if (!silent) addToast('error', '获取数据失败，请检查服务器连接');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  // Keep ref in sync with the latest fetchMessages so the interval
  // always calls the up-to-date version without being a dependency itself.
  useEffect(() => {
    fetchMessagesRef.current = fetchMessages;
  });

  // Mount-only effect: initial load + polling. Never re-runs.
  useEffect(() => {
    fetchMessagesRef.current?.();
    intervalRef.current = setInterval(() => fetchMessagesRef.current?.(true), 3000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  /* ── Derived counts ── */
  const filtered       = messages.filter(m => filter === 'all' ? true : m.status === filter);
  const pendingCount   = messages.filter(m => m.status === 'pending').length;
  const submittedCount = messages.filter(m => m.status === 'submitted').length;
  const pendingInList  = filtered.filter(m => m.status === 'pending');

  /* ── Selection ── */
  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    const ids = pendingInList.map(m => m.id);
    const allSelected = ids.every(id => selected.has(id)) && ids.length > 0;
    setSelected(prev => {
      const next = new Set(prev);
      allSelected ? ids.forEach(id => next.delete(id)) : ids.forEach(id => next.add(id));
      return next;
    });
  };

  const clearSelection = () => setSelected(new Set());

  /* ── Edit ── */
  const openEdit = (msg: Message) => {
    setEditTarget(msg);
    setEditForm({ name: msg.name, end_of_id: msg.end_of_id, remark: msg.remark, creator_name: msg.creator_name });
  };
  const closeEdit = () => setEditTarget(null);

  const saveEdit = async () => {
    if (!editTarget) return;
    try {
      const res  = await fetch(`/api/messages/${editTarget.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      const data = await res.json();
      if (data.success) { addToast('success', '修改已保存'); closeEdit(); fetchMessages(true); }
      else addToast('error', data.message || '保存失败');
    } catch { addToast('error', '网络错误，保存失败'); }
  };

  /* ── Delete ── */
  const doDelete = async (id: string) => {
    try {
      const res  = await fetch(`/api/messages/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        addToast('success', '记录已删除');
        setSelected(prev => { const n = new Set(prev); n.delete(id); return n; });
        fetchMessages(true);
      } else addToast('error', data.message || '删除失败');
    } catch { addToast('error', '网络错误，删除失败'); }
    finally { setDeleteConfirm(null); }
  };

  /* ── Batch Delete ── */
  const batchDelete = async () => {
    if (selected.size === 0) return;
    setBatchDeleting(true);
    try {
      const res  = await fetch('/api/messages', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selected) }),
      });
      const data = await res.json();
      if (data.success) {
        addToast('success', data.message);
        clearSelection();
        fetchMessagesRef.current?.(true);
      } else {
        addToast('error', data.message || '批量删除失败');
      }
    } catch {
      addToast('error', '网络错误，批量删除失败');
    } finally {
      setBatchDeleting(false);
      setBatchDeleteConfirm(false);
    }
  };

  /* ── Batch Submit ── */
  const batchSubmit = async () => {
    if (selected.size === 0) return;
    setSubmitting(true);
    try {
      const res  = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selected), openid: 'relay_station', nickname: '中转站' }),
      });
      const data = await res.json();
      if (data.success) { addToast('success', data.message); clearSelection(); fetchMessages(true); }
      else addToast('error', data.message || '提交失败');
    } catch { addToast('error', '网络错误，提交失败'); }
    finally { setSubmitting(false); }
  };

  const pendingSelected  = filtered.filter(m => m.status === 'pending' && selected.has(m.id));
  const allPendingSelected =
    pendingInList.length > 0 && pendingInList.every(m => selected.has(m.id));

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="app-wrapper">

      {/* ── Toasts ── */}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast ${t.type}`}>
            <span>{t.type === 'success' ? '✓' : t.type === 'error' ? '✕' : 'ℹ'}</span>
            {t.message}
          </div>
        ))}
      </div>

      {/* ── Header ── */}
      <header className="app-header">
        <div className="header-brand">
          <div className="header-icon">📡</div>
          <div>
            <h1 className="header-title">微信消息中转站</h1>
            <p className="header-subtitle">接收 · 审核 · 批量提报 — WeChat Message Relay</p>
          </div>
        </div>
        <div className="header-stats">
          <div className="stat-chip total">
            <span className="dot" />
            共 {messages.length} 条
          </div>
          <div className="stat-chip pending">
            <span className="dot" />
            待提报 {pendingCount}
          </div>
          <div className="stat-chip submitted">
            <span className="dot" />
            已提报 {submittedCount}
          </div>
        </div>
      </header>

      {/* ── Toolbar ── */}
      <div className="toolbar">
        <div className="toolbar-left">
          <div className="filter-tabs">
            {(['all', 'pending', 'submitted'] as const).map(f => (
              <button
                key={f}
                id={`filter-${f}`}
                className={`filter-tab${filter === f ? ' active' : ''}`}
                onClick={() => setFilter(f)}
              >
                {f === 'all' ? '全部' : f === 'pending' ? '待提报' : '已提报'}
              </button>
            ))}
          </div>
          <button
            id="btn-select-all"
            className="btn btn-secondary btn-sm"
            onClick={selectAll}
          >
            {allPendingSelected ? '取消全选' : '全选待提报'}
          </button>
        </div>
        <div className="toolbar-right">
          <div className="refresh-indicator">
            <span className="refresh-dot" />
            自动刷新
          </div>
          <button
            id="btn-refresh"
            className="btn btn-secondary btn-sm"
            onClick={() => fetchMessages()}
          >
            ↺ 刷新
          </button>
        </div>
      </div>

      {/* ── Batch bar ── */}
      {selected.size > 0 && (
        <div className="batch-bar">
          <span className="batch-count">
            已选 {selected.size} 条（其中待提报 {pendingSelected.length} 条）
          </span>
          <button id="btn-clear-select" className="btn btn-secondary btn-sm" onClick={clearSelection}>
            取消选择
          </button>
          <button
            id="btn-batch-delete"
            className="btn btn-danger btn-sm"
            onClick={() => setBatchDeleteConfirm(true)}
            disabled={batchDeleting || selected.size === 0}
          >
            🗑 批量删除 ({selected.size})
          </button>
          <button
            id="btn-batch-submit"
            className="btn btn-submit btn-sm"
            onClick={batchSubmit}
            disabled={submitting || pendingSelected.length === 0}
          >
            {submitting
              ? <><span className="spinner" /> 提交中...</>
              : `提报至服务器 (${pendingSelected.length})`}
          </button>
        </div>
      )}

      {/* ── Message list ── */}
      {loading ? (
        <div className="empty-state">
          <div className="empty-icon">
            <span className="spinner" style={{ width: 40, height: 40, borderWidth: 2.5 }} />
          </div>
          <h3>加载中...</h3>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📭</div>
          <h3>
            {filter === 'all' ? '暂无消息' : filter === 'pending' ? '暂无待提报消息' : '暂无已提报消息'}
          </h3>
          <p>
            等待 Python 脚本推送数据<br />
            接收地址：<code>POST /api/messages</code>
          </p>
        </div>
      ) : (
        <div className="message-list">
          {filtered.map(msg => (
            <div
              key={msg.id}
              className={`message-card${selected.has(msg.id) ? ' selected' : ''}${msg.status === 'submitted' ? ' submitted' : ''}`}
            >
              <input
                type="checkbox"
                id={`chk-${msg.id}`}
                className="card-checkbox"
                checked={selected.has(msg.id)}
                onChange={() => toggleSelect(msg.id)}
                disabled={msg.status === 'submitted'}
              />
              <div className="card-body">
                <div className="card-top">
                  <span className="card-name">{msg.name}</span>
                  <span className="card-id">{msg.end_of_id}</span>
                  <span className={`status-badge ${msg.status}`}>
                    {msg.status === 'pending' ? '待提报' : '已提报'}
                  </span>
                </div>
                <div className="card-meta">
                  <span>👤 {msg.creator_name || '未知'}</span>
                  <span>🕐 {formatTime(msg.created_at)}</span>
                  <span>🔗 {msg.source}</span>
                </div>
                {msg.remark && (
                  <div className="card-remark" title={msg.remark}>
                    {msg.remark}
                  </div>
                )}
              </div>
              <div className="card-actions">
                <button
                  id={`btn-edit-${msg.id}`}
                  className="btn btn-secondary btn-sm btn-icon"
                  onClick={() => openEdit(msg)}
                  title="编辑"
                >✏️</button>
                {deleteConfirm === msg.id ? (
                  <>
                    <button className="btn btn-danger btn-sm" onClick={() => doDelete(msg.id)}>确认</button>
                    <button className="btn btn-secondary btn-sm" onClick={() => setDeleteConfirm(null)}>取消</button>
                  </>
                ) : (
                  <button
                    id={`btn-delete-${msg.id}`}
                    className="btn btn-danger btn-sm btn-icon"
                    onClick={() => setDeleteConfirm(msg.id)}
                    title="删除"
                  >🗑</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Edit Modal ── */}
      {editTarget && (
        <div
          className="modal-overlay"
          onClick={e => { if (e.target === e.currentTarget) closeEdit(); }}
        >
          <div className="modal" role="dialog" aria-modal="true">
            <div className="modal-header">
              <span className="modal-title">编辑记录</span>
              <button className="modal-close" onClick={closeEdit} aria-label="关闭">✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label" htmlFor="edit-name">姓名</label>
                <input
                  id="edit-name"
                  className="form-input"
                  value={editForm.name}
                  onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="请输入姓名"
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="edit-end-of-id">ID 尾号（6位）</label>
                <input
                  id="edit-end-of-id"
                  className="form-input"
                  value={editForm.end_of_id}
                  onChange={e => setEditForm(f => ({ ...f, end_of_id: e.target.value }))}
                  placeholder="例如：123456"
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="edit-creator">操作人</label>
                <input
                  id="edit-creator"
                  className="form-input"
                  value={editForm.creator_name}
                  onChange={e => setEditForm(f => ({ ...f, creator_name: e.target.value }))}
                  placeholder="消息发送人昵称"
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="edit-remark">备注（原始消息）</label>
                <textarea
                  id="edit-remark"
                  className="form-textarea"
                  value={editForm.remark}
                  onChange={e => setEditForm(f => ({ ...f, remark: e.target.value }))}
                  placeholder="原始微信消息内容"
                />
              </div>
            </div>
            <div className="modal-footer">
              <button id="btn-cancel-edit" className="btn btn-secondary" onClick={closeEdit}>取消</button>
              <button id="btn-save-edit"   className="btn btn-primary"   onClick={saveEdit}>保存修改</button>
            </div>
          </div>
        </div>
      )}
      {/* ── Batch Delete Confirm Modal ── */}
      {batchDeleteConfirm && (
        <div
          className="modal-overlay"
          onClick={e => { if (e.target === e.currentTarget) setBatchDeleteConfirm(false); }}
        >
          <div className="modal" role="dialog" aria-modal="true" style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <span className="modal-title">⚠️ 确认批量删除</span>
              <button className="modal-close" onClick={() => setBatchDeleteConfirm(false)} aria-label="关闭">✕</button>
            </div>
            <div className="modal-body">
              <p style={{ margin: 0, lineHeight: 1.7, color: 'var(--text-secondary)' }}>
                即将删除 <strong style={{ color: 'var(--danger)' }}>{selected.size} 条</strong>记录：
              </p>
              <ul style={{ margin: '12px 0 0', paddingLeft: 20, color: 'var(--text-secondary)', lineHeight: 1.9 }}>
                {pendingSelected.length > 0 && (
                  <li>待提报 <strong>{pendingSelected.length}</strong> 条</li>
                )}
                {selected.size - pendingSelected.length > 0 && (
                  <li>已提报 <strong>{selected.size - pendingSelected.length}</strong> 条</li>
                )}
              </ul>
              <p style={{ margin: '12px 0 0', color: 'var(--danger)', fontSize: '0.85rem' }}>
                此操作不可撤销，请确认是否继续。
              </p>
            </div>
            <div className="modal-footer">
              <button
                id="btn-cancel-batch-delete"
                className="btn btn-secondary"
                onClick={() => setBatchDeleteConfirm(false)}
                disabled={batchDeleting}
              >
                取消
              </button>
              <button
                id="btn-confirm-batch-delete"
                className="btn btn-danger"
                onClick={batchDelete}
                disabled={batchDeleting}
              >
                {batchDeleting ? <><span className="spinner" /> 删除中...</> : `确认删除 (${selected.size})`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
