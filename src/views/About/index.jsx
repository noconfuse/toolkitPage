import { Card, CardContent, CardHeader, Paper, Typography } from '@mui/material';
import { Box } from '@mui/system';
import React from 'react';
import { styled } from '@mui/material/styles';
import { purple } from '@mui/material/colors';

const PaperSubTitle = styled(Typography)(({ theme }) => ({
    position: 'relative',
    margin: "20px 0 10px",
    "&:after": {
        content: '""',
        position: 'absolute',
        display: 'inline-block',
        width: "6px",
        height: '100%',
        backgroundColor: purple[300],
        left: "-8px"
    }
}))


export default function About() {
    return <Box color="text.primary" height="100%">
        <Paper elevation={4} sx={{ color: "text.primary", p: 3 }}>
            <Typography variant="h4">关于本站</Typography>
            <Typography variant="subtitle1" mt={1}>
                在这里，你可以更快，更便捷地获取到想要的资讯，同时方便地处理这些资源。
            </Typography>
            <Typography variant="subtitle1" mt={1}>
                2022年11月11日，网站建立，目前还处于初始版本。
            </Typography>
            <PaperSubTitle variant="h6">内容</PaperSubTitle>
            <Typography variant="body1">网站、软件工具、chrome插件等。</Typography>
            <PaperSubTitle variant="h6">功能服务</PaperSubTitle>
            <Typography variant="body1" >关于此网站的服务功能，目前主要有如下几个方面，部分功能还在加紧开发中。</Typography>
            <Typography variant="body1" mt={1}>1.热榜数据，包含百度、新浪微博、知乎、头条、b站、IT之家；</Typography>
            <Typography variant="body1" mt={1}>2.媒体处理工具，主要有以下功能，图片去水印、图片压缩、视频去水印，音频格式分析、音视频合成等；</Typography>
            <Typography variant="body1" mt={1}>3.搜索功能，包含各大搜索引擎的搜索，同时加入翻译、文章查询、图片相似搜索、数据查询；</Typography>
            <Typography variant="body1" mt={1}>4.抓取网站内容、截长图、网页颜色拾取等功能，会以chrome插件的形式提供服务；</Typography>
            <PaperSubTitle>联系</PaperSubTitle>
            <Typography variant="body1" >广告合作联系QQ:<span class="text-violet-600 font-bold">1192706763</span>，非合作的小伙伴有问题请留言。</Typography>
            <Typography variant="body1" mt={1}>还可以搜索关注微信公众号”<span class="text-violet-600 font-bold">所遇非良人</span>“，发消息给我们。</Typography>
            <Typography variant="body1" mt={1}>有需求的小伙可以提出您宝贵的意见或者需求，我们会和您一起丰富此站功能。</Typography>
        </Paper>
    </Box>
}