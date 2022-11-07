const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const databasePath = path.join(__dirname, "covid19IndiaPortal.db");

const app = express();

app.use(express.json());

let database = null;

const initializeDbAndServer = async () => {
  try {
    database = await open({
      filename: databasePath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () =>
      console.log("Server Running at http://localhost:3000/")
    );
  } catch (error) {
    console.log(`DB Error: ${error.message}`);
    process.exit(1);
  }
};

initializeDbAndServer();

const convertDbObjectToResponseObject = (dbObject) => {
  return {
    stateId: dbObject.state_id,
    StateName: dbObject.state_name,
    population: dbObject.population,
  };
};

const convertDbObjectToResponseObject1 = (dbObject) => {
  return {
    districtId: dbObject.district_id,
    districtName: dbObject.district_name,
    stateId: dbObject.state_id,
    cases: dbObject.cases,
    cured: dbObject.cured,
    active: dbObject.active,
    deaths: dbObject.deaths,
  };
};

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUser = `select * from user where username="${username}"`;
  const dbuser = await database.get(selectUser);
  if (dbuser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const ispass = await bcrypt.compare(password, dbuser.password);
    if (ispass !== true) {
      response.status(400);
      response.send("Invalid password");
    } else {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "yaswanth");
      response.send({ jwtToken });
    }
  }
});

const logger = (request, respond, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    respond.status(401);
    respond.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "yaswanth", async (error, payload) => {
      if (error) {
        respond.status(401);
        respond.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};

app.get("/states/", logger, async (request, response) => {
  const selectStatesQuery = `
    select * from state;`;
  const dbStates = await database.all(selectStatesQuery);
  response.send(
    dbStates.map((eachPlayer) => convertDbObjectToResponseObject(eachPlayer))
  );
});

app.get("/states/:stateId/", logger, async (request, respond) => {
  const { stateId } = request.params;
  const selectStateQ = `select * from state where state_id=${stateId};`;
  const dbState = await database.get(selectStateQ);
  respond.send(convertDbObjectToResponseObject(dbState));
});

app.post("/districts/", logger, async (request, respond) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const addQuery = `
insert into district(district_name,state_id,cases,cured,active,deaths)
values("${districtName}",${stateId},${cases},${cured},${active},${deaths});`;
  await database.run(addQuery);
  respond.send("District Successfully Added");
});

app.get("/districts/:districtId/", logger, async (request, respond) => {
  const { districtId } = request.params;
  const Query = `select * from district where district_id=${districtId};`;
  const districtlist = await database.get(Query);
  respond.send(convertDbObjectToResponseObject1(districtlist));
});

app.delete("/districts/:districtId/", logger, async (request, respond) => {
  const { districtId } = request.params;
  const Query = `delete  from district where district_id=${districtId};`;
  const districtlist = await database.run(Query);
  respond.send("District Removed");
});

app.put("/districts/:districtId/", logger, async (request, respond) => {
  const { districtId } = request.params;
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const addQuery = `
update district
set
district_name="${districtName}",
state_id=${stateId},
cases=${cases},
cured=${cured},
active=${active},
deaths=${deaths}
where district_id=${districtId};`;
  await database.run(addQuery);
  respond.send("District Details Updated");
});

app.get("/states/:stateId/stats/", logger, async (request, respond) => {
  const { stateId } = request.params;
  const Query = `select sum(cases) as totalCases,sum(cured) as totalCured,
    sum(active) as totalAcive,sum(deaths) as totalDeaths from district
    where state_id=${stateId};`;
  const db = await database.get(Query);
  respond.send(db);
});

module.exports = app;
