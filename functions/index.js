
// test fcm token : dgXtuODLSFWaQup13XbX1V:APA91bHabPFzjqT8ybDybCaSwSqfIeszNVBCFcqKAuPJOMLaxsc7PYkH7-H7o7bLLkLyNdoQLJ1pAHPgFDddPxaBgckbXDnN-LR2X-CzfsxGxhsMeM__d655q-oQkPgIS5_XAqttXGnD

// ErrorCode
// 20000 - fcmToken is null
// 20001 - fcmToken is invalid

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
     *  === 채팅 프로세스 ===
     * 1. 채팅에 필요한 정보를 받아온다. - 성공
     * 2. 게이머의 uID를 통해 fcmToken을 조회한다. - 
     *  2.1. fcmToken이 없다면 함수를 더 진행할 필요없다. 종료한다.
     * 3. RDB에 데이터 쓰기 작업을 진행해준다.
     * 4. 완료했다면 fcmToken을 보내준다
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
    // 2.3. senderType이 USER이면 유저 닉네임을 type이 GAMER면 게이머 이름을 가져온다.

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
      console.log('fcmToken', '=>', fcmToken);      
      throw new functions.https.HttpsError(20000, 'message : fcmToken is null');
    }
 
    // 2.3. senderType이 USER이면 유저 닉네임을 type이 GAMER면 게이머 이름을 가져온다.
    var senderRef;
    var senderSnapshot;
    var senderName;
    if (senderType == 'USER') {
      senderRef = db.collection('UserList').doc(senderUID);
      senderSnapshot = await senderRef.get();
      senderName = senderSnapshot.get('nickname');
      
    }

    if (senderType == 'GAMER') {
      senderRef = db.collection('GamerList').doc(senderUID);
      senderSnapshot = await senderRef.get();
      senderName = senderSnapshot.get('name');
      
    }




    // 3. RDB에 데이터 쓰기 작업을 진행해준다.
    //  3.0. 대화중인 채팅방을 찾는다. 
    //  3.1. 만약 없다면 하나를 만든다.
    //  3.2. 채팅방 하나에 comments를 만든다.
    //  3.3. 채팅방 하나에 users를 만든다.

    //  3.0. 대화중인 채팅방을 찾는다. 
    // const chattingRoomUserRef  = admin.database()
    // .ref()
    // .child('ChattingRooms')
    // .orderByChild(`users/${senderUID}`)
    // .equalTo(true)
    

    // const temp = chattingRoomUserRef.get().then((snapshot) => {
    //   if (snapshot.exists()) {
    //     console.log(snapshot.val());
    //     res.json({temp: snapshot.val()});
    //   } else {
    //     console.log("No data available");
    //     res.json({temp: "No data available"});
    //   }
    // }).catch((error) => {
    //   console.error(error);
    //   res.json({temp: error});
    // });
    
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
 
    
    // 채팅방이 존재하면 기존 채팅방에 채팅메시지를 입력해준다.
    if (isThereChattingRoom) {

      console.log('base chatting room');

      commentDate = new Date().getTime(); 
      const chattingRoomRef  = admin.database().ref()
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

    // 채팅방이 없으면 새로 만든다. 그리고 메시지를 입력한다.
    else {

      console.log('new chatting room');
      
      commentDate = new Date().getTime(); 
      const chattingRoomRef  = admin.database().ref()
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
    
    admin.database().ref()
    .child('users')
    .child(senderUID)
    .child('ChattingRooms')
    .child(chattingRoomId) 
    .set(receiverUID)

    
    admin.database().ref()
    .child('users')
    .child(receiverUID)
    .child('ChattingRooms')
    .child(chattingRoomId) 
    .set(senderUID)
     

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

        // 유효하지 않은 토큰을 가진 사람에게 보낸 말은 지운다.
        if (error.code === 'messaging/invalid-registration-token' ||
            error.code === 'messaging/registration-token-not-registered') {
            
              console.log('noti error', '=>' , error.code);


              //  3.1. 말풍선 데이터를 삭제
               admin.database()
              .ref(`comments/${commentUID}`)
              .remove();
              

              //  3.2. 수신자가 데이터 삭제
              const receiverRef = admin.database()
              .ref(`user/${receiverUID}/${commentUID}`)
              .remove();

              //  3.3. 발신자가 데이터 삭제
              const senderRef = admin.database()
              .ref(`user/${senderUID}/${commentUID}`)
              .remove();

          throw new functions.https.HttpsError(20001, 'message : fcmToken is invalid');

        }
        
      }
    });

    res.json({commentDate: commentDate});
  });

exports.makeUppercase = functions.firestore.document('/messages/{documentId}')
.onCreate((snap, context) => {
  
  const gamerUID = snap.data().to;
  const from     = snap.data().from;
  const content  = snap.data().content;

  // 선수 이메일을 사용해 fcmToken을 알아낸다
  const fcmToken = admin.firestore.ref('/GamerList/${gamerUID}/fcmToken')
  
  const original = snap.data().original;
  functions.logger.log('Uppercasing', context.params.documentId, original);

  const uppercase = original.toUpperCase();


  return snap.ref.set({uppercase}, {merge: true});
});
