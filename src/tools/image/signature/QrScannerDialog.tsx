'use client';

// 光学回收·接收端：打开摄像头扫描手机屏幕上展示的交接码，识别出笔迹载荷。
// 全部在本地完成：视频流不出设备，识别后即关闭摄像头。

import * as React from 'react';
import jsQR from 'jsqr';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import CloseIcon from '@mui/icons-material/Close';

type Status = 'idle' | 'scanning' | 'error';

/** 把 getUserMedia / 枚举设备的失败原因归类成可读提示 */
function classifyCameraError(err: unknown): string {
  const name = (err as DOMException)?.name ?? (err as Error)?.message ?? '';
  switch (name) {
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return '未检测到摄像头：这台电脑没有摄像头或摄像头未接入。';
    case 'NotAllowedError':
    case 'PermissionDeniedError':
      return '摄像头权限被拒绝：请在浏览器地址栏把摄像头权限设为「允许」后重试。';
    case 'NotReadableError':
    case 'AbortError':
      return '摄像头被其它应用占用或暂时不可用，请关闭占用它的程序后重试。';
    case 'OverconstrainedError':
      return '无法调用摄像头：设备与系统摄像头设置不匹配。';
    case 'SecurityError':
      return '浏览器禁止访问摄像头：请通过 HTTPS 或 localhost 打开本站。';
    case 'TypeError':
      return '当前浏览器不支持摄像头接口，请更换 Chrome / Edge / Safari。';
    default:
      return `无法访问摄像头：${name || '未知原因'}，请检查摄像头接入与浏览器权限。`;
  }
}

export function QrScannerDialog({
  open,
  onDecoded,
  onClose,
}: {
  open: boolean;
  onDecoded: (data: string) => void;
  onClose: () => void;
}) {
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const rafRef = React.useRef(0);
  const [status, setStatus] = React.useState<Status>('idle');
  const [errorText, setErrorText] = React.useState('');
  const doneRef = React.useRef(false);

  const onDecodedRef = React.useRef(onDecoded);
  onDecodedRef.current = onDecoded;

  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setStatus('idle');
    setErrorText('');
    doneRef.current = false;
    rafRef.current = 0;

    const view = videoRef.current;
    if (view) view.srcObject = null;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const tick = () => {
      const video = videoRef.current;
      if (cancelled) return;
      if (video && ctx && video.readyState >= video.HAVE_ENOUGH_DATA && video.videoWidth > 0) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0);
        try {
          const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const res = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' });
          if (res?.data && !doneRef.current) {
            doneRef.current = true;
            setStatus('idle');
            onDecodedRef.current(res.data);
            return;
          }
        } catch {
          /* 部分环境截帧受限，忽略继续 */
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    const start = async () => {
      try {
        // 先枚举视频输入设备：没有摄像头时直接给出明确提示，不再白等
        const devices = await navigator.mediaDevices?.enumerateDevices?.();
        if (cancelled) return;
        if (!devices?.some((d) => d.kind === 'videoinput')) {
          setStatus('error');
          setErrorText('未检测到摄像头：这台电脑没有摄像头或摄像头未接入。');
          return;
        }
        const stream = await navigator.mediaDevices!.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: 'environment' } },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        setStatus('scanning');
        const video = videoRef.current;
        if (!video) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        video.srcObject = stream;
        void video.play().catch(() => {});
        rafRef.current = requestAnimationFrame(tick);
      } catch (err) {
        if (cancelled) return;
        setStatus('error');
        setErrorText(classifyCameraError(err));
      }
    };
    void start();

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      if (view && view.srcObject) {
        (view.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
      }
    };
  }, [open]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      slotProps={{ paper: { sx: { borderRadius: 1.5 } } }}
    >
      <DialogTitle sx={{ fontSize: 14, fontFamily: 'var(--font-geist-mono)', color: 'text.secondary', py: 1.5 }}>
        从手机接收签名
        <CloseIcon
          onClick={onClose}
          sx={{ position: 'absolute', top: 12, right: 12, fontSize: 18, cursor: 'pointer' }}
        />
      </DialogTitle>
      <DialogContent sx={{ pb: 2.5 }}>
        <Stack spacing={1.5}>
          <Box
            sx={{
              position: 'relative',
              width: '100%',
              aspectRatio: '4 / 3',
              borderRadius: 1,
              overflow: 'hidden',
              bgcolor: '#0f1f1d',
            }}
          >
            <video
              ref={videoRef}
              playsInline
              muted
              autoPlay
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
            {status !== 'scanning' && (
              <Stack
                sx={{
                  position: 'absolute',
                  inset: 0,
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: status === 'error' ? '#ffcdb2' : 'text.secondary',
                  bgcolor: 'rgba(0,0,0,0.45)',
                  gap: 1,
                  p: 2,
                }}
              >
                <Typography variant="body2" sx={{ color: '#fff', textAlign: 'center' }}>
                  {status === 'error' ? errorText : '正在启动摄像头…'}
                </Typography>
                {status === 'error' && (
                  <>
                    <Typography
                      variant="caption"
                      sx={{ color: '#ffcdb2', textAlign: 'center', maxWidth: 300, lineHeight: 1.6 }}
                    >
                      没有摄像头？可让手机/平板端直接「下载 PNG」后传到电脑导入。
                    </Typography>
                    <Button size="small" variant="contained" color="inherit" onClick={onClose}>
                      关闭
                    </Button>
                  </>
                )}
              </Stack>
            )}
            {status === 'scanning' && (
              <Typography
                variant="caption"
                sx={{
                  position: 'absolute',
                  left: '50%',
                  bottom: 10,
                  transform: 'translateX(-50%)',
                  color: '#fff',
                  bgcolor: 'rgba(0,0,0,0.5)',
                  px: 1.25,
                  py: 0.4,
                  borderRadius: 1,
                  whiteSpace: 'nowrap',
                }}
              >
                将手机上的交接二维码对准摄像头
              </Typography>
            )}
          </Box>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            仅读取你手机屏幕上的二维码，识别完成后立即关闭摄像头，画面不会离开你的设备。
          </Typography>
        </Stack>
      </DialogContent>
    </Dialog>
  );
}