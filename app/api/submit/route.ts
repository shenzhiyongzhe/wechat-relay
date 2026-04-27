import { NextRequest, NextResponse } from 'next/server';
import { getAllMessages, markAsSubmitted } from '@/lib/db';

const FINAL_SERVER_URL = 'http://114.67.174.175:8001/persons/wechat_input';

// POST /api/submit — 批量提交选中的消息到最终服务器
export async function POST(req: NextRequest) {
  try {
    const { ids, openid, nickname } = await req.json();

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ success: false, message: '请选择至少一条消息' }, { status: 400 });
    }

    const allMessages = await getAllMessages();
    const selected = allMessages.filter(m => ids.includes(m.id));

    if (selected.length === 0) {
      return NextResponse.json({ success: false, message: '未找到选中的消息' }, { status: 404 });
    }

    const results: { id: string; name: string; ok: boolean; error?: string }[] = [];

    for (const msg of selected) {
      try {
        const payload = {
          name: msg.name,
          end_of_id: msg.end_of_id,
          remark: msg.remark,
          creator_name: msg.creator_name || nickname || '微信监控',
        };
        const res = await fetch(FINAL_SERVER_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            openid: openid || 'relay_station',
          },
          body: JSON.stringify(payload),
        });
        results.push({ id: msg.id, name: msg.name, ok: res.ok, error: res.ok ? undefined : `HTTP ${res.status}` });
      } catch (e) {
        results.push({ id: msg.id, name: msg.name, ok: false, error: String(e) });
      }
    }

    const successIds = results.filter(r => r.ok).map(r => r.id);
    if (successIds.length > 0) {
      await markAsSubmitted(successIds);
    }

    const allOk = results.every(r => r.ok);
    return NextResponse.json({
      success: allOk,
      message: allOk ? `成功提交 ${successIds.length} 条记录` : `部分提交失败，成功 ${successIds.length}/${results.length} 条`,
      results,
    });
  } catch (e) {
    console.error('POST /api/submit error:', e);
    return NextResponse.json({ success: false, message: '服务器内部错误' }, { status: 500 });
  }
}
