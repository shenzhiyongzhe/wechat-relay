import { NextRequest, NextResponse } from 'next/server';
import { updateMessage, deleteMessage } from '@/lib/db';

// PUT /api/messages/:id — 更新单条消息
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const updated = await updateMessage(id, body);
  if (!updated) {
    return NextResponse.json({ success: false, message: '记录不存在' }, { status: 404 });
  }
  return NextResponse.json({ success: true, data: updated });
}

// DELETE /api/messages/:id — 删除单条消息
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ok = await deleteMessage(id);
  if (!ok) {
    return NextResponse.json({ success: false, message: '记录不存在' }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
