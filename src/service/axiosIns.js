import axios from 'axios';


const axiosIns = axios.create({
    baseURL: process.env.NODE_ENV==='development'?"//127.0.0.1:3001":"//web.deerblock.cn"
})

export default axiosIns;