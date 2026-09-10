'use client';

// 手机签名邀请：把 /sign 横屏签名页的绝对地址编码成二维码，
// 手机扫码后直达干净的横屏签名页，签完再通过「从手机接收」回传。

import * as React from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import Stack from '@mui/material/Stack';
import CloseIcon from '@mui/icons-material/Close';
import LinkIcon from '@mui/icons-material/Link';
import { QrImage } from '@/components/tools/QrImage';

export function InvitePhoneDialog({
  open,
  url,
  onClose,
}: {
  open: boolean;
  url: string | null;
  onClose: () => void;
}) {
  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      /* ignore */
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      slotProps={{ paper: { sx: { borderRadius: 1.5 } } }}
    >
      <DialogTitle sx={{ fontSize: 14, fontFamily: 'var(--font-geist-mono)', color: 'text.secondary', py: 1.5 }}>
        发起手机签名
        <CloseIcon
          onClick={onClose}
          sx={{ position: 'absolute', top: 12, right: 12, fontSize: 18, cursor: 'pointer' }}
        />
      </DialogTitle>
      <DialogContent sx={{ pb: 2.5 }}>
        <Stack spacing={1.5} sx={{ alignItems: 'center' }}>
          <Box sx={{ p: 1.5, bgcolor: '#fff', borderRadius: 1, border: 1, borderColor: 'divider' }}>
            <QrImage data={url} size={260} />
          </Box>
          <Button size="small" variant="outlined" onClick={() => void copy()} startIcon={<LinkIcon sx={{ fontSize: 14 }} />}>
            复制链接
          </Button>
        </Stack>
      </DialogContent>
    </Dialog>
  );
}