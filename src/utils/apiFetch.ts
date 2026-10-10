/**
 * Safe fetch utility that guarantees graceful error handling,
 * prevents HTML parse crashes (e.g. "Unexpected token '<' ..."),
 * and provides clear, descriptive Arabic error messages.
 * Automatically resolves cloud backend URL when running inside mobile APK (Capacitor).
 */

export function getApiBaseUrl(): string {
  if (typeof window === 'undefined') return '';
  
  const savedUrl = localStorage.getItem('bollywood_api_server_url');
  if (savedUrl && savedUrl.trim()) {
    return savedUrl.trim().replace(/\/+$/, '');
  }

  // In Capacitor Android/iOS, hostname is localhost or protocol is capacitor:
  const isCapacitor = 
    window.location.protocol === 'capacitor:' ||
    (window as any).Capacitor?.isNativePlatform?.() ||
    (window.location.hostname === 'localhost' && window.location.port === '');

  if (isCapacitor) {
    const envUrl = import.meta.env.VITE_API_URL;
    if (envUrl) return envUrl.replace(/\/+$/, '');
    // Default Cloud URL for the APK app
    return 'https://ais-dev-bw6j7pmuiyh2semyrvfxzz-90618466889.europe-west2.run.app';
  }

  return '';
}

export function resolveApiUrl(path: string): string {
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  const base = getApiBaseUrl();
  if (base && path.startsWith('/')) {
    return `${base}${path}`;
  }
  return path;
}

export async function safeFetchJson<T = any>(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<T> {
  let resolvedInput = input;
  if (typeof input === 'string' && input.startsWith('/')) {
    resolvedInput = resolveApiUrl(input);
  }

  let response: Response;
  try {
    response = await fetch(resolvedInput, init);
  } catch (netErr: any) {
    throw new Error(
      netErr.message?.includes('Failed to fetch')
        ? 'تعذر الاتصال بسيرفر المعالجة السحابي. يرجى التحقق من اتصال الإنترنت أو استخدام الفيديو محلياً على الهاتف.'
        : `خطأ في الاتصال بالشبكة: ${netErr.message || netErr}`
    );
  }

  const contentType = response.headers.get('content-type') || '';
  let data: any = null;

  if (contentType.includes('application/json')) {
    try {
      data = await response.json();
    } catch {
      // Fallback to text parsing if json() fails
      data = null;
    }
  }

  if (!data) {
    try {
      const text = await response.text();
      if (text && text.trim().startsWith('{')) {
        data = JSON.parse(text);
      }
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    if (data && data.error) {
      throw new Error(data.error);
    }

    if (response.status === 413) {
      throw new Error(
        'حجم الملف كبير جداً وتجاوز الحد المسموح به للرفع (413 Payload Too Large). يرجى رفع ملف أصغر أو استخراج مسار الصوت بصيغة MP3.'
      );
    }
    if (response.status === 504 || response.status === 502) {
      throw new Error(
        'استغرق الخادم وقتاً أطول من المتوقع لمعالجة الطلب (Gateway Timeout / 504). يرجى إعادة المحاولة أو تجربة ملف أصغر.'
      );
    }
    if (response.status === 503) {
      throw new Error(
        'خوادم المعالجة تشهد ضغطاً مؤقتاً (503 Service Unavailable). يرجى النقر على إعادة المحاولة بعد لحظات.'
      );
    }
    if (response.status === 404) {
      throw new Error('الرابط أو الملف المطلوب غير موجود على الخادم (404 Not Found).');
    }

    throw new Error(`فشل الطلب من الخادم (رمز الاستجابة: ${response.status} ${response.statusText || ''}).`);
  }

  if (data === null) {
    throw new Error(
      `تعذر قراءة استجابة السيرفر بتنسيق JSON (رمز الحالة: ${response.status}، نوع المحتوى: ${contentType || 'غير محدد'}). ` +
      'إذا كان ملف الفيديو كبيراً، يرجى تجربة خيار استخراج الصوت التلقائي أو رفع ملف MP3 خفيف أو تشغيل نسخة Streamlit للأفلام الطويلة.'
    );
  }

  return data as T;
}
