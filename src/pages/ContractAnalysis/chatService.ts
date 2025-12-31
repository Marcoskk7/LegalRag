import { ChatRequest, GroundingMetadata } from './typing';

const API_BASE_URL = 'http://127.0.0.1:8080';

export type ChatEvent =
  | { type: 'text_chunk'; text: string }
  | { type: 'grounding_metadata'; data: GroundingMetadata }
  | { type: 'done' }
  | { type: 'error'; message: string };

export async function* streamChat(
  payload: ChatRequest,
): AsyncGenerator<ChatEvent, void, unknown> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/v1/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      // 尝试读取错误信息
      const text = await res.text();
      yield { type: 'error', message: `HTTP ${res.status}: ${text}` };
      return;
    }

    if (!res.body) {
      yield { type: 'error', message: 'Response body is empty' };
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let currentEvent = 'message'; // 默认 event 名字，虽然 SSE 标准里默认是 message，但这里根据 API 文档可能有 text_chunk 等

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      let idx;
      // SSE 规范：事件之间由两个换行符分隔
      while ((idx = buffer.indexOf('\n\n')) !== -1) {
        const raw = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);

        // 解析 event: ... 和 data: ...
        const lines = raw.split('\n');
        let eventType = currentEvent;
        let dataStr = '';

        for (const line of lines) {
          if (line.startsWith('event:')) {
            eventType = line.slice(6).trim();
          } else if (line.startsWith('data:')) {
            dataStr += line.slice(5).trim();
          }
        }

        // 解析 data
        let data: any = {};
        if (dataStr) {
          try {
            data = JSON.parse(dataStr);
          } catch (e) {
            console.error('Failed to parse SSE data JSON:', dataStr);
          }
        }

        // 根据 eventType yield 不同的事件
        switch (eventType) {
          case 'text_chunk':
            if (data.text) {
              yield { type: 'text_chunk', text: data.text };
            }
            break;
          case 'grounding_metadata':
            yield { type: 'grounding_metadata', data };
            break;
          case 'error':
            yield { type: 'error', message: data.message || 'Unknown error' };
            break;
          case 'done':
            yield { type: 'done' };
            return; // 结束流
          default:
            // 忽略未知的 event
            break;
        }
      }
    }
  } catch (err: any) {
    yield { type: 'error', message: err.message || 'Network error' };
  }
}

