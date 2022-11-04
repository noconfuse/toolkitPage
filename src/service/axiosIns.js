import axios from 'axios';


const axiosIns = axios.create({
    baseURL:"//web.deerblock.cn/webapi"
})

export default axiosIns;