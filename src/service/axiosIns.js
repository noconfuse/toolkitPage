import axios from 'axios';


const axiosIns = axios.create({
    baseURL:"//web.deerblock.cn"
})

export default axiosIns;