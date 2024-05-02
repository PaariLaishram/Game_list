import express from 'express'
import pg from 'pg'
import ejs from 'ejs'
import axios from 'axios'
const app = express()
import igdb from 'igdb-api-node'
import bodyParser from 'body-parser'
import env from "dotenv"; 
env.config();


app.use(express.static("public"))
app.use(bodyParser.urlencoded({ extended: false }))

const db = new pg.Client(
    {
        user: process.env.PG_USER,
        password: process.env.PG_PASSWORD,
        host: process.env.PG_HOST,
        database: process.env.PG_DB,
        port: 5432
    }
)
var gameNamesArr = []
var sortingOptions = ''
let sortFlag = false

const clientId = process.env.CLIENT_ID
const clientSecret = process.env.CLIENT_SECRET
var accessToken = ''


db.connect()

//  This is the root route which will be loaded by default
app.get('/', async (req, res) => {
    let dbQuery = ''

    try {
        //Authenticate to igdb api
        const authResponse = await axios.post(`https://id.twitch.tv/oauth2/token`, {
            client_id: clientId,
            client_secret: clientSecret,
            grant_type: 'client_credentials'
        })
        accessToken = authResponse.data.access_token
        //Below line of codes will send request to igdb to fetch the game details by their game name
        const gameNameQuery = await db.query('select game_name from game_list')
        const gameNamesArr = gameNameQuery.rows.map(item => item.game_name)
        for (const item of gameNamesArr) {
            const response = await igdb.default(`${clientId}`, `${accessToken}`)
                .search(`${item}`)
                .fields(['*'])
                .request('/games')

            const igdbId = response.data[0].id
            const gameSummary = response.data[0].summary
            const releaseDate = response.data[0].first_release_date
            const ratingQuery = response.data[0].rating
            const gameRating = ratingQuery.toFixed(2)

            //db query to fill up the records
            await db.query(`update game_list 
                   set summary = $1, 
                   igdb_id = $2,
                   release_date = to_timestamp($3),
                   rating = $4
                where game_name = $5`, [gameSummary, igdbId, releaseDate, gameRating, item])
        }
        // get the records from db which will then be rendered 
        if (sortFlag) {
            dbQuery = await sortOptions(sortingOptions)
        }
        else {
            dbQuery = await db.query('select * from game_list order by game_id asc')
            sortFlag = false
        }
        res.render('index.ejs', { games: dbQuery.rows, })
    }
    catch (err) {
        console.log(err)
    }

})

// This code executes when user tries to edit reviews
app.post('/edit', async (req, res) => {
    try {
        const reqGameId = req.body.gameId
        const updatedGameReview = req.body.updatedReview
        await db.query(`update game_list
        set game_review = $1 where game_id = $2`,
            [updatedGameReview, reqGameId])
        const response = await db.query(`select * from game_list 
        where game_id = $1`, [reqGameId])
        res.redirect('/')
    }
    catch (err) {
        console.log(err)
    }


})

//Code when user uses the sort feature
app.post('/sort', (req, res) => {
    sortingOptions = req.body.sortOptions
    sortFlag = true
    res.redirect('/')

})

async function sortOptions(option) {
    var query = ''
    switch (option) {
        case 'name':
            query = await db.query('select * from game_list order by game_name asc')
            break
        case 'rating':
            query = await db.query('select * from game_list order by rating desc')
            break
        case 'releaseDate':
            query = await db.query('select * from game_list order by release_date desc')
            break
        default:
            break
    }
    return query
}



app.listen(3000, () => {
    console.log('Listening on port 3000')
})