
import Landing from '../views/Landing'
import PersonIcon from '@mui/icons-material/Person';
import ConstructionIcon from "@mui/icons-material/Construction";


const routesConfig = [
    {
        name:"首页",
        path:'/',
        component:Landing,
        meta:{
            title:"首页",
            hide:true
        }
    },
    {
        name:"实用工具",
        path:"/utils",
        component:Landing,
        meta:{
            title:"实用工具",
            icon:ConstructionIcon,
        }
    },
    {
        name:"博客文章",
        path:"/blogs",
        component:Landing,
        meta:{
            title:"博客文章",
            icon:PersonIcon,
        }
    }
]

export default routesConfig