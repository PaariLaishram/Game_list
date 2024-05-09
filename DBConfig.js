import pg from "pg"
const {Pool} = pg

const itemsPool = new Pool({
    connectionString: process.env.DBConnLink,
    ssl:{
        rejectUnathorized:false
    }
})

export default itemsPool;