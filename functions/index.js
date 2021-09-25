
// test fcm token : dgXtuODLSFWaQup13XbX1V:APA91bHabPFzjqT8ybDybCaSwSqfIeszNVBCFcqKAuPJOMLaxsc7PYkH7-H7o7bLLkLyNdoQLJ1pAHPgFDddPxaBgckbXDnN-LR2X-CzfsxGxhsMeM__d655q-oQkPgIS5_XAqttXGnD

// ErrorCode
// 20000 - fcmToken is null
// 20001 - fcmToken is invalid
// 20002 - failed to send notification

//Message Type
// - CHATTING
// -
// -

const functions      = require('firebase-functions');
const admin          = require('firebase-admin');
const serviceAccount = require('./keyfile.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://thewarofstars-8f9a8-default-rtdb.firebaseio.com"
});
const db = admin.firestore();

 
/**
 * 채팅 프로세스
 * 1. 채팅에 필요한 정보를 받아온다.
 * 2. uID로 fcmToken을 조회한다.
 * 3. RDB에 데이터 쓰기작업을 진행한다.
 * 4. 노티피케이션 전송을 시작한다.
 */
exports.sendMessage = functions.https.onRequest(async (req, res) => {
    
    // 1. 채팅에 필요한 정보를 받아온다.
    const receiverUID  = req.query.to;
    const senderUID    = req.query.from;
    const senderType   = req.query.type; // USER or GAMER
    const content      = req.query.content;
    
    
    // 2. uID로 fcmToken을 조회한다.
    // 2.1. senderType이 USER이면 게이머 fcmToken을 type이 GAMER면 유저 fcmToken을 가져온다.
    // 2.2. fcmToken이 없다면 함수를 더 진행할 필요없다. 종료한다.
    // 2.3. fcmToken 유효성 검사를 한다.
    // 2.4. senderType이 USER이면 유저 닉네임을 type이 GAMER면 게이머 이름을 가져온다.

    // 2.1. senderType이 USER이면 게이머 fcmToken을 type이 GAMER면 유저 fcmToken을 가져온다.
    var fcmTokenRef;
    var fcmTokenSnapshot;
    var fcmToken;
    if (senderType == 'USER') {
      fcmTokenRef      = db.collection('GamerList').doc(receiverUID);
      fcmTokenSnapshot = await fcmTokenRef.get();
      fcmToken         = fcmTokenSnapshot.get('fcmToken');
    }
    if (senderType == 'GAMER') {
      fcmTokenRef      = db.collection('UserList').doc(receiverUID);
      fcmTokenSnapshot = await fcmTokenRef.get();
      fcmToken         = fcmTokenSnapshot.get('fcmToken');

    }
    

    // 2.2. fcmToken이 없다면 함수를 더 진행할 필요없다. 종료한다.
    if (fcmToken == null) {
      console.log('fcmToken is null', '=>', fcmToken);      
      throw new functions.https.HttpsError(20000, 'message : fcmToken is null');
    } else {
      console.log('fcmToken is not null', '=>', fcmToken);      
    }

    // 2.3. fcmToken 유효성 검사를 한다.
    await admin.messaging()
    .send({
      token: fcmToken
    }, true)
    .then(result => {
      console.log('fcmToken validation result', '=>', result);
    })
    .catch(err => {
      throw new functions.https.HttpsError(20001, 'message : fcmToken is invalid');
    })
 
    // 2.4. senderType이 USER이면 유저 닉네임을 type이 GAMER면 게이머 이름을 가져온다.
    var senderRef;
    var senderSnapshot;
    var senderName;
    if (senderType == 'USER') {
      senderRef = db.collection('UserList').doc(senderUID);
      senderSnapshot = await senderRef.get();
      senderName = senderSnapshot.get('nickname');
      console.log('USER name : ', senderName);
      
    }

    if (senderType == 'GAMER') {
      senderRef = db.collection('GamerList').doc(senderUID);
      senderSnapshot = await senderRef.get();
      senderName = senderSnapshot.get('name');
      console.log('GAMER name : ', senderName);
      
    }




    // 3. RDB에 데이터 쓰기 작업을 진행해준다.
    //  3.0. 대화중인 채팅방을 찾는다. 
    //  3.1. 채팅방이 존재하면 기존 채팅방에 채팅메시지를 입력해준다.
    //  3.2. 채팅방이 없으면 새로 만든다. 그리고 메시지를 입력한다.
    //  3.3. 보낸이가 가진 채팅방 정보를 저장한다.
    //  3.4. 수신이가 가진 채팅방 정보를 저장한다.
 
    
    //  3.0. 대화중인 채팅방을 찾는다.
    var isThereChattingRoom = false
    var chattingRoomId;
    var commentDate;

    await admin.database()
    .ref()
    .child('users')
    .child(senderUID)
    .child('ChattingRooms')
    .get()
    .then((snapshot) => {
      
      if (snapshot.exists()) {

        console.log("chatting room list start");
        
        snapshot.forEach((childSnapshot) => {
          var roomId = childSnapshot.key;    // 채팅방 id
          var userId = childSnapshot.val();  // 채팅방에 있는 사용자 id
          
          if (receiverUID == userId) {
            isThereChattingRoom = true;
            chattingRoomId = roomId;
            // break
          }
        })

      } else {
        console.log("No chatting room");
      } 
    }).catch((error) => {
      res.json({temp: 'error'});
    })
 
    
    // 3.1. 채팅방이 존재하면 기존 채팅방에 채팅메시지를 입력해준다.
    if (isThereChattingRoom) {

      console.log('base chatting room');

      commentDate = new Date().getTime(); 
      await admin.database().ref()
      .child('ChattingRooms')
      .child(chattingRoomId)
      .child('comments')
      .push()
      .set({
        content: content,
        timeStamp: commentDate,
        uid: senderUID
      });

    }

    // 3.2. 채팅방이 없으면 새로 만든다. 그리고 메시지를 입력한다.
    else {

      console.log('new chatting room');
      
      commentDate = new Date().getTime(); 
      const chattingRoomRef  = await admin.database().ref()
      .child('ChattingRooms')
      .push()
      chattingRoomRef
      .child('comments')
      .push()
      .set({
        content: content,
        timeStamp: commentDate,
        uid: senderUID
      });
      chattingRoomId = chattingRoomRef.key
    }
    
    // 3.3. 보낸이가 가진 채팅방 정보를 저장한다.
    await admin.database().ref()
    .child('users')
    .child(senderUID)
    .child('ChattingRooms')
    .child(chattingRoomId) 
    .set(receiverUID)

    // 3.4. 수신이가 가진 채팅방 정보를 저장한다.    
    await admin.database().ref()
    .child('users')
    .child(receiverUID)
    .child('ChattingRooms')
    .child(chattingRoomId) 
    .set(senderUID)
     
    // 4. 노티피케이션 전송을 시작한다.
    //  4.1. 페이로드를 작성한다. 
    //  4.2. 메시지를 전송한다.
    //  4.3. 콜백을 처리한다.

    // 4.1. 페이로드를 작성한다. 
    const notificationPayload = {
      notification: {
        title: '메시지 도착',
        body: `${content}`,
        icon: 'https://blog.kakaocdn.net/dn/kBexr/btqxjBUVgL6/C1hJKqfcwwfkglSWwQdN91/img.png'
      },
      data: {
        notiType   : 'CHATTING',
        senderType : `${senderType}`,
        senderName : `${senderName}`,
        senderUID  : `${senderUID}`
      }
    };

    // 4.2. 메시지를 전송한다.
    const response = await admin.messaging()
    .sendToDevice(fcmToken, notificationPayload);
    
    
    // 4.3. 콜백을 처리한다.
    response.results.forEach((result, index) => {
      const error = result.error;
      if (error) {
        throw new functions.https.HttpsError(20002, 'message : failed to send notification');
      }
    });

    res.json({commentDate: commentDate});
  });

  exports.sendPayNotification = functions.https.onRequest(async (req, res) => {
  
    const receiverUID = req.query.to;
    const senderUID   = req.query.from;
    const content     = req.query.content;
    const price       = req.query.price;

    // 게이머 닉네임 추출
    var gamerRef = db.collection('GamerList').doc(receiverUID);
    var gamerSnapShot = await gamerRef.get();
    var gamerName = gamerSnapShot.get('name');
    var gamerTribe = gamerSnapShot.get('tribe');
    var gamerID = gamerSnapShot.get('gameID');

    // 아마추어 닉네임 추출
    var userRef = db.collection('UserList').doc(senderUID);
    var userSnapShot = await userRef.get();
    var userNickname = userSnapShot.get('nickname');
    var userTribe = userSnapShot.get('tribe');
    var userID = userSnapShot.get('gameID');

    // fcmToken추출
    var fcmTokenRef       = db.collection('GamerList').doc(receiverUID);
    var fcmTokenSnappShot = await fcmTokenRef.get();
    var fcmToken          = fcmTokenSnappShot.get('fcmToken');

    var gamerCode = Math.floor(Math.random() * 900) + 100;
    var userCode = Math.floor(Math.random() * 900) + 100;
    
    var payDate = new Date().getTime(); 
    var payStatus = 'payYet' // payYet, paySuccess
    var payUID;

    // 거래정보 저장
    await db.collection('PayList').add({
      gamerUID : receiverUID,
      gamerName : gamerName,
      gamerTribe : gamerTribe,
      gamerID : gamerID,
      gamerCode : gamerCode,

      userUID : senderUID,
      userNickname : userNickname,
      userTribe : userTribe,
      userID : userID,
      userCode : userCode,

      payDate : payDate,
      content : content,
      price : price,
      payStatus : payStatus

    }).then(result => {
      payUID = result.id;
    })
    .catch(err => {
      throw new functions.https.HttpsError(20001, 'message : fcmToken is invalid');
    })

    const notificationPayload = {
      notification: {
        title: `${userNickname}님께서 결제를 완료하였습니다!`,
        body: '코칭을 시작해 주세요!',
        icon: 'https://blog.naver.com/common/util/imageZoom.jsp?url=https://blogpfthumb-phinf.pstatic.net/MjAyMTA5MDNfMTcg/MDAxNjMwNTk2NzI2NDc3.iqGxj76IIFIgf6DR3A6y5QGjWu2tIzA3eR6eB0tj1YIg.yJ6MgTcQ9JH8k3JEwsYgBLzkIGUuNKtekP-ICF4WXTUg.PNG.happymj42/profileImage.png&rClickYn=true&isOwner=false'
      },
      data: {
        gamerUID : receiverUID,
        gamerName : gamerName,
        gamerCode : gamerCode.toString(),
        gamerTribe : gamerTribe,
        gamerID : gamerID,

        userUID : senderUID,
        userNickname : userNickname, 
        userCode : userCode.toString(),
        userTribe : userTribe,
        userID : userID,

        content : content,
        price : price,
        payDate : payDate.toString(),
        payStatus : payStatus, // payYet, paySuccess,

        payUID : payUID,
        notiType : 'PAY'
      }
    } 

    const response = await admin.messaging()
    .sendToDevice(fcmToken, notificationPayload);

    const result = {
      gamer : {
        gamerUID : receiverUID,
        gamerName : gamerName,
        gamerCode : gamerCode,
        gamerTribe : gamerTribe,
        gamerID : gamerID,
      },
      user : {
        userUID : senderUID,
        userNickname : userNickname,
        userCode : userCode,
        userTribe : userTribe,
        userID : userID
      },
      content : content,
      price : price,
      payDate : payDate,
      payStatus : payStatus,

      payUID : payUID,
      notiType : 'PAY' 
    }

    res.json(result)
  });

  exports.sendPayCompleteNotification = functions.https.onRequest(async (req, res) => {
  
    const payUID = req.query.payUID;

    // 결제 내역 불러오기
    var payRef = db.collection('PayList').doc(payUID);
    var paySnappShot = await payRef.get();
    var gamerUID = paySnappShot.get('gamerUID');
    var gamerName = paySnappShot.get('gamerName');
    var gamerCode = paySnappShot.get('gamerCode');
    var gamerTribe = paySnappShot.get('gamerTribe');
    var gamerID = paySnappShot.get('gamerID');

    var userUID = paySnappShot.get('userUID');
    var userNickname = paySnappShot.get('userNickname');
    var userCode = paySnappShot.get('userCode');
    var userTribe = paySnappShot.get('userTribe');
    var userID = paySnappShot.get('userID');
  
    var price = paySnappShot.get('price');
    var markedPrice = markCommaForPrice(price);
    var payDate = new Date().getTime();
    var payStatus = 'paySuccess'; 

    // fcmToken추출
    var fcmTokenRef       = db.collection('UserList').doc(userUID);
    var fcmTokenSnappShot = await fcmTokenRef.get();
    var fcmToken          = fcmTokenSnappShot.get('fcmToken');
    
    const notificationPayload = {
      notification: {
        title: `${userNickname}님께서 인수확인을 완료하였습니다!`,
        body: `환전포인트 ${markedPrice}P가 적립되었습니다!`,
        icon: 'https://blog.naver.com/common/util/imageZoom.jsp?url=https://blogpfthumb-phinf.pstatic.net/MjAyMTA5MDNfMTcg/MDAxNjMwNTk2NzI2NDc3.iqGxj76IIFIgf6DR3A6y5QGjWu2tIzA3eR6eB0tj1YIg.yJ6MgTcQ9JH8k3JEwsYgBLzkIGUuNKtekP-ICF4WXTUg.PNG.happymj42/profileImage.png&rClickYn=true&isOwner=false'
      },
      data: {
        gamerUID : gamerUID,
        gamerName : gamerName,
        gamerCode : gamerCode.toString(),
        gamerTribe : gamerTribe,
        gamerID : gamerID,

        userUID : userUID,
        userNickname : userNickname, 
        userCode : userCode.toString(),
        userTribe : userTribe,
        userID : userID,

        price : price,
        payDate : payDate.toString(),
        payStatus : payStatus, // payYet, paySuccess
        payUID : payUID, 
        notiType : 'PAY_SUCCESS'
      }
    } 

    const response = await admin.messaging()
    .sendToDevice(fcmToken, notificationPayload);

    const result = {
      gamer : {
        gamerUID : gamerUID,
        gamerName : gamerName,
        gamerCode : gamerCode,
        gamerTribe : gamerTribe,
        gamerID : gamerID,
      },
      user : {
        userUID : userUID,
        userNickname : userNickname,
        userCode : userCode,
        userTribe : userTribe,
        userID : userID
      },
      
      price : price,
      payDate : payDate,
      payStatus : 'paySuccess',
      payUID : payUID, 
      notiType : 'PAY_SUCCESS' 
    }

    res.json(result)
    // res.json(paySnappShot)
  });

  function markCommaForPrice(price) {
    var regexp = /\B(?=(\d{3})+(?!\d))/g;
    return price.toString().replace(regexp, ',');
  }
// exports.makeUppercase = functions.firestore.document('/messages/{documentId}')
// .onCreate((snap, context) => {
  
//   const gamerUID = snap.data().to;
//   const from     = snap.data().from;
//   const content  = snap.data().content;

//   // 선수 이메일을 사용해 fcmToken을 알아낸다
//   const fcmToken = admin.firestore.ref('/GamerList/${gamerUID}/fcmToken')
  
//   const original = snap.data().original;
//   functions.logger.log('Uppercasing', context.params.documentId, original);

//   const uppercase = original.toUpperCase();


//   return snap.ref.set({uppercase}, {merge: true});
// });
