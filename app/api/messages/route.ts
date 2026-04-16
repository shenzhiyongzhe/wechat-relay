import { NextRequest, NextResponse } from 'next/server';
import { getAllMessages, createMessage, deleteMessages } from '@/lib/db';

// GET /api/messages — 获取消息列表
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status') || undefined;
  const messages = await getAllMessages(status);
  return NextResponse.json({ success: true, data: messages });
}

// DELETE /api/messages — 批量删除
export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json();
    const { ids } = body as { ids: string[] };
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { success: false, message: '请提供要删除的 ID 列表' },
        { status: 400 }
      );
    }
    const count = await deleteMessages(ids);
    return NextResponse.json({ success: true, count, message: `已删除 ${count} 条记录` });
  } catch (e) {
    console.error('DELETE /api/messages error:', e);
    return NextResponse.json({ success: false, message: '服务器内部错误' }, { status: 500 });
  }
}

// POST /api/messages — 接收 Python 脚本推送的数据（含服务端去重）
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, end_of_id, remark, creator_name } = body;

    if (!name || !end_of_id) {
      return NextResponse.json(
        { success: false, message: '缺少必填字段: name, end_of_id' },
        { status: 400 }
      );
    }

    // ── 服务端去重：检查相同 name + end_of_id + remark 是否已存在 ──
    const existing = await getAllMessages();
    const isDuplicate = existing.some(
      m =>
        m.name === name &&
        m.end_of_id === end_of_id &&
        (m.remark || '').trim() === (remark || '').trim()
    );

    if (isDuplicate) {
      return NextResponse.json(
        { success: true, duplicate: true, message: '重复消息，已跳过' },
        { status: 200 }
      );
    }

    const message = await createMessage({
      name,
      end_of_id,
      remark: remark || '',
      creator_name: creator_name || '未知',
      source: 'wechat',
    });

    return NextResponse.json({ success: true, data: message }, { status: 201 });
  } catch (e) {
    console.error('POST /api/messages error:', e);
    return NextResponse.json({ success: false, message: '服务器内部错误' }, { status: 500 });
  }
}
