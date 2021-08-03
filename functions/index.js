
// test fcm token : dgXtuODLSFWaQup13XbX1V:APA91bHabPFzjqT8ybDybCaSwSqfIeszNVBCFcqKAuPJOMLaxsc7PYkH7-H7o7bLLkLyNdoQLJ1pAHPgFDddPxaBgckbXDnN-LR2X-CzfsxGxhsMeM__d655q-oQkPgIS5_XAqttXGnD

// ErrorCode
// 20000 - fcmToken is null
// 20001 - fcmToken is invalid

//Message Type
// - Chatting
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
    const content      = req.query.content;
    
    // 2. 게이머의 uID가 올바른지 조회한다. fcmToken을 조회한다.
    // 2.1. fcmToken이 없다면 함수를 더 진행할 필요없다. 종료한다.

    // 2.1. fcmToken이 없다면 함수를 더 진행할 필요없다. 종료한다.
    const fcmTokenRef      = db.collection('GamerList').doc(receiverUID);
    const fcmTokenSnapshot = await fcmTokenRef.get();
    const fcmToken         = fcmTokenSnapshot.get('fcmToken');

    // 2.1. fcmToken이 없다면 함수를 더 진행할 필요없다. 종료한다.
    if (fcmToken == null) {
      console.log('fcmToken', '=>', fcmToken);      
      throw new functions.https.HttpsError(20000, 'message : fcmToken is null');
    }

    // 3. RDB에 데이터 쓰기 작업을 진행해준다.
    //  3.1. 말풍선 데이터 한 개를 만든다. 
    //  3.2. 수신자가 이를 참조한다.
    //  3.3. 발신자가 이를 참조한다.

    //  3.1. 말풍선 데이터 한 개를 만든다.
    const commentDate = new Date().getTime(); 
    const commentRef  = admin.database()
    .ref('comments/')
    .push();
    commentRef.set({
      content: content,
      timeStamp: commentDate,
    });
    const commentUID = commentRef.key

    //  3.2. 수신자가 이를 참조한다.
    const receiverRef = admin.database()
    .ref(`user/${receiverUID}/${commentUID}`)
    .set(false);

    //  3.3. 발신자가 이를 참조한다.
    const senderRef = admin.database()
    .ref(`user/${senderUID}/${commentUID}`)
    .set(true);

    // 4. 완료했다면 fcmToken을 보내준다.
    // 4.1. 페이로드를 작성한다.
    // 4.2. 메시지를 전송한다.
    // 4.3. 콜백을 처리한다.

    // 4.1. 페이로드를 작성한다. 
    const notificationPayload = {
      notification: {
        title: '메시지 도착',
        body: `${content}`,
        icon: 'https://blog.kakaocdn.net/dn/kBexr/btqxjBUVgL6/C1hJKqfcwwfkglSWwQdN91/img.png'
      },
      data: {
        type: 'CHATTING'
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
