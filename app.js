const express = require('express')
const app = express()
app.use(express.json())
const path = require('path')
const dbPath = path.join(__dirname, 'covid19IndiaPortal.db')
const sqlite3 = require('sqlite3')
const {open} = require('sqlite')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
let db = null
const initializedbAndServer = async function () {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    })
    app.listen(3000, function () {
      console.log('Server is running')
    })
  } catch (e) {
    console.log(`DB Error:${e.message}`)
    process.exit(1)
  }
}
initializedbAndServer()
const authenticate = function (request, response, next) {
  let jwtToken
  const authHeader = request.headers['authorization']
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(' ')[1]
  }
  if (jwtToken === undefined) {
    response.status(401)
    response.send('Invalid JWT Token')
  } else {
    jwt.verify(jwtToken, 'my_private_token', async function (error, payload) {
      if (error) {
        response.status(401)
        response.send('Invalid JWT Token')
      } else {
        next()
      }
    })
  }
}
app.post('/login/', async function (request, response) {
  const {username, password} = request.body
  const selectQuery = `
  SELECT * 
  FROM 
    user 
  WHERE 
    username='${username}';
  `
  const bd = await db.get(selectQuery)
  if (bd === undefined) {
    response.status(400)
    response.send('Invalid user')
  } else {
    const isPasswordCorrect = await bcrypt.compare(password, bd.password)
    if (isPasswordCorrect === true) {
      const payload = {username: username}
      const jwtToken = jwt.sign(password, 'my_private_token')
      response.send({jwtToken})
    } else {
      response.status(400)
      response.send('Invalid password')
    }
  }
})

app.get('/states/', authenticate, async function (request, response) {
  const selectStatesQuery = `
  SELECT * 
  FROM 
    state;
  `
  const result = await db.all(selectStatesQuery)
  response.send(
    result.map(function (each) {
      return {
        stateId: each.state_id,
        stateName: each.state_name,
        population: each.population,
      }
    }),
  )
})

app.get('/states/:stateId', authenticate, async function (request, response) {
  const {stateId} = request.params
  const getStateQuery = `
  SELECT * 
  FROM 
    state 
  WHERE 
    state_id=${stateId};
  `
  const result = await db.get(getStateQuery)
  response.send({
    stateId: result.state_id,
    stateName: result.state_name,
    population: result.population,
  })
})

app.post('/districts/', authenticate, async function (request, response) {
  const {districtName, stateId, cases, cured, deaths, active} = request.body
  console.log(districtName)
  const postDistrictQuery = `
  INSERT INTO district 
    (district_name,state_id,cases,cured,active,deaths)
  VALUES 
    ('${districtName}',${stateId},${cases},${cured},${deaths},${active});
  `
  await db.run(postDistrictQuery)
  response.send('District Successfully Added')
})

app.get(
  '/districts/:districtId',
  authenticate,
  async function (request, response) {
    const {districtId} = request.params
    const getStateQuery = `
  SELECT * 
  FROM 
    district
  WHERE 
    district_id=${districtId};
  `
    const result = await db.get(getStateQuery)
    response.send({
      districtId: result.district_id,
      districtName: result.district_name,
      stateId: result.state_id,
      cases: result.cases,
      cured: result.cured,
      active: result.active,
      deaths: result.deaths,
    })
  },
)

app.delete(
  '/districts/:districtId/',
  authenticate,
  async function (request, response) {
    const {districtId} = request.params
    const deleteDistrictQuery = `
  DELETE FROM district
  WHERE 
    district_id=${districtId};
  `
    const result = await db.run(deleteDistrictQuery)
    response.send('District Removed')
  },
)

app.put(
  '/districts/:districtId',
  authenticate,
  async function (request, response) {
    const {districtName, stateId, cases, cured, active, deaths} = request.body
    const {districtId} = request.params
    const updateDistrictQuery = `
  UPDATE district 
    SET district_name='${districtName}',
        state_id=${stateId},
        cases=${cases},
        cured=${cured},
        active=${active},
        deaths=${deaths}
  WHERE 
    district_id=${districtId};
  `

    await db.run(updateDistrictQuery)
    response.send('District Details Updated')
  },
)

app.get(
  '/states/:stateId/stats',
  authenticate,
  async function (request, response) {
    const {stateId} = request.params
    const getTotalStatsQuery = `
  SELECT 
    SUM(cases) as totalCases,
    SUM(cured) as totalCured,
    SUM(active) as totalActive,
    SUM(deaths) as totalDeaths
  FROM 
    district 
  WHERE 
    state_id=${stateId};
  `
    const result = await db.get(getTotalStatsQuery)
    response.send(result)
  },
)
module.exports = app
