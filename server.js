const express = require('express');
const app = express();
const cron = require('node-cron');
const cronParser = require('cron-parser');
const { fork } = require('child_process');

const cors = require('cors');
const bodyParser = require('body-parser');
let Profiles;

const port = process.env.PORT || 3000;

/*****************************************Socket.io***************************************************/

const server = require('http').createServer(app);
const io = require('socket.io')(server, {
  cors: {
    origin: 'http://127.0.0.1:8080',
  },
});

io.on('connection', socket => {
  console.log('User connected:' + socket.id);
});

/*****************************************MongoDB***************************************************/
const { MongoClient, ObjectId } = require('mongodb');
const uri =
  'mongodb+srv://JakobFerguson:XbdHM2FJsjg4ajiO@trinitycapitalproduction.1yr5eaa.mongodb.net/?retryWrites=true&w=majority';
const client = new MongoClient(uri);

async function main(client) {
  try {
    await client.connect();
    console.log('Connected, 20');
  } catch (e) {
    console.error(e);
  }
}

main(client).catch(console.error);

/*****************************************Main Page***************************************************/

app.use(express.static('public'));
app.use(express.json());
app.use(
  cors({
    origin: ['http://localhost:3000', 'http://127.0.0.1:8080'],
    credentials: true,
  })
);

app.get('/profiles', async (req, res) => {
  try {
    const profiles = await client
      .db('TrinityCapital')
      .collection('User Profiles')
      .find()
      .toArray();

    // Emit the profiles data to all connected clients

    for (let i = 0; i < profiles.length; i++) {
      let name = profiles[i].memberName;
    }

    const Profiles = await client
      .db('TrinityCapital')
      .collection('User Profiles')
      .find()
      .toArray();

    io.emit('profiles', Profiles);

    res.status(200).send(Profiles);
  } catch (error) {
    console.error('Error fetching profiles:', error);
    res.status(500).send('Internal Server Error');
  }
});

app.post('/loans', async (req, res) => {
  const { parcel } = req.body;
  const profile = parcel[0];
  const amount = parcel[1];
  let name = profile.checkingAccount.accountHolder;

  try {
    const UserProfile = await client
      .db('TrinityCapital')
      .collection('User Profiles')
      .findOne({ 'checkingAccount.accountHolder': name });

    // Update the transactions in the user profile
    const balance = UserProfile.checkingAccount.transactions.reduce(
      (acc, mov) => acc + mov,
      0
    );
    await client
      .db('TrinityCapital')
      .collection('User Profiles')
      .updateOne(
        { 'checkingAccount.accountHolder': name },
        {
          $push: { 'checkingAccount.transactions': amount },
          $set: { 'checkingAccount.balanceTotal': balance },
        }
      );
    let newDate = new Date().toISOString();
    await client
      .db('TrinityCapital')
      .collection('User Profiles')
      .updateOne(
        { 'checkingAccount.accountHolder': name },
        { $push: { 'checkingAccount.movementsDates': newDate } }
      );
    const updatedUserProfile = await client
      .db('TrinityCapital')
      .collection('User Profiles')
      .findOne({ 'checkingAccount.accountHolder': name });

    const updatedChecking = updatedUserProfile.checkingAccount;

    console.log(updatedChecking, '99');

    io.emit('checkingAccountUpdate', updatedChecking);

    res.status(200).json({ message: 'Transaction successful' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/donations', async (req, res) => {
  const { parcel } = req.body;
  const account = parcel[0];
  const amount = parcel[1];
  const name = account.accountHolder;

  try {
    const UserProfile = await client
      .db('TrinityCapital')
      .collection('User Profiles')
      .findOne({ 'checkingAccount.accountHolder': name });

    //Update the transactions in the user profile

    const balance = UserProfile.checkingAccount.transactions.reduce(
      (acc, mov) => acc + mov,
      0
    );

    await client
      .db('TrinityCapital')
      .collection('User Profiles')
      .updateOne(
        { 'checkingAccount.accountHolder': name },
        {
          $push: { 'checkingAccount.transactions': -amount },
          $set: { 'checkingAccount.balanceTotal': balance },
        }
      );
    let newDate = new Date().toISOString();
    await client
      .db('TrinityCapital')
      .collection('User Profiles')
      .updateOne(
        { 'checkingAccount.accountHolder': 'Jakob Ferguson' },
        { $push: { 'checkingAccount.movementsDates': newDate } }
      );

    const updatedProfileDonation = await client
      .db('TrinityCapital')
      .collection('User Profiles')
      .findOne({ 'checkingAccount.accountHolder': name });

    const updatedDonCheck = updatedProfileDonation.checkingAccount;

    io.emit('donationChecking', updatedDonCheck);
  } catch (err) {}
});

app.post('/donationsSavings', async (req, res) => {
  const { parcel } = req.body;
  const account = parcel[0];
  const amount = parcel[1];
  const name = account.accountHolder;

  const UserProfile = await client
    .db('TrinityCapital')
    .collection('User Profiles')
    .findOne({ 'savingsAccount.accountHolder': name });

  const balance = UserProfile.savingsAccount.transactions.reduce(
    (acc, mov) => acc + mov,
    0
  );
  await client
    .db('TrinityCapital')
    .collection('User Profiles')
    .updateOne(
      { 'savingsAccount.accountHolder': name },
      {
        $push: { 'savingsAccount.transactions': -amount },
        $set: { 'savingsAccount.balanceTotal': balance },
      }
    );
  let newDate = new Date().toISOString();
  await client
    .db('TrinityCapital')
    .collection('User Profiles')
    .updateOne(
      { 'savingsAccount.accountHolder': name },
      { $push: { 'savingsAccount.movementsDates': newDate } }
    );

  const updatedProfileDonation = await client
    .db('TrinityCapital')
    .collection('User Profiles')
    .findOne({ 'checkingAccount.accountHolder': name });

  const updatedDonSav = updatedProfileDonation.savingsAccount;

  io.emit('donationSaving', updatedDonSav);
});

server.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

/*****************************************Bills and Payments***************************************************/

app.post('/bills', async (req, res) => {
  const { parcel } = req.body;

  const child = fork('billServ.js');
  child.send(parcel);
});
