"use strict";

/* Apple Game Center Auth
https://developer.apple.com/documentation/gamekit/gklocalplayer/1515407-generateidentityverificationsign#discussion

const authData = {
  publicKeyUrl: 'https://valid.apple.com/public/timeout.cer',
  timestamp: 1460981421303,
  signature: 'PoDwf39DCN464B49jJCU0d9Y0J',
  salt: 'saltST==',
  bundleId: 'com.valid.app'
  id: 'playerId',
};
*/
const {
  Parse
} = require('parse/node');

const crypto = require('crypto');

const https = require('https');

const url = require('url');

const cache = {}; // (publicKey -> cert) cache

function verifyPublicKeyUrl(publicKeyUrl) {
  const parsedUrl = url.parse(publicKeyUrl);

  if (parsedUrl.protocol !== 'https:') {
    return false;
  }

  const hostnameParts = parsedUrl.hostname.split('.');
  const length = hostnameParts.length;
  const domainParts = hostnameParts.slice(length - 2, length);
  const domain = domainParts.join('.');
  return domain === 'apple.com';
}

function convertX509CertToPEM(X509Cert) {
  const pemPreFix = '-----BEGIN CERTIFICATE-----\n';
  const pemPostFix = '-----END CERTIFICATE-----';
  const base64 = X509Cert;
  const certBody = base64.match(new RegExp('.{0,64}', 'g')).join('\n');
  return pemPreFix + certBody + pemPostFix;
}

function getAppleCertificate(publicKeyUrl) {
  if (!verifyPublicKeyUrl(publicKeyUrl)) {
    throw new Parse.Error(Parse.Error.OBJECT_NOT_FOUND, `Apple Game Center - invalid publicKeyUrl: ${publicKeyUrl}`);
  }

  if (cache[publicKeyUrl]) {
    return cache[publicKeyUrl];
  }

  return new Promise((resolve, reject) => {
    https.get(publicKeyUrl, res => {
      let data = '';
      res.on('data', chunk => {
        data += chunk.toString('base64');
      });
      res.on('end', () => {
        const cert = convertX509CertToPEM(data);

        if (res.headers['cache-control']) {
          var expire = res.headers['cache-control'].match(/max-age=([0-9]+)/);

          if (expire) {
            cache[publicKeyUrl] = cert; // we'll expire the cache entry later, as per max-age

            setTimeout(() => {
              delete cache[publicKeyUrl];
            }, parseInt(expire[1], 10) * 1000);
          }
        }

        resolve(cert);
      });
    }).on('error', reject);
  });
}

function convertTimestampToBigEndian(timestamp) {
  const buffer = Buffer.alloc(8);
  const high = ~~(timestamp / 0xffffffff);
  const low = timestamp % (0xffffffff + 0x1);
  buffer.writeUInt32BE(parseInt(high, 10), 0);
  buffer.writeUInt32BE(parseInt(low, 10), 4);
  return buffer;
}

function verifySignature(publicKey, authData) {
  const verifier = crypto.createVerify('sha256');
  verifier.update(authData.playerId, 'utf8');
  verifier.update(authData.bundleId, 'utf8');
  verifier.update(convertTimestampToBigEndian(authData.timestamp));
  verifier.update(authData.salt, 'base64');

  if (!verifier.verify(publicKey, authData.signature, 'base64')) {
    throw new Parse.Error(Parse.Error.OBJECT_NOT_FOUND, 'Apple Game Center - invalid signature');
  }
} // Returns a promise that fulfills if this user id is valid.


async function validateAuthData(authData) {
  if (!authData.id) {
    throw new Parse.Error(Parse.Error.OBJECT_NOT_FOUND, 'Apple Game Center - authData id missing');
  }

  authData.playerId = authData.id;
  const publicKey = await getAppleCertificate(authData.publicKeyUrl);
  return verifySignature(publicKey, authData);
} // Returns a promise that fulfills if this app id is valid.


function validateAppId() {
  return Promise.resolve();
}

module.exports = {
  validateAppId,
  validateAuthData
};
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9BZGFwdGVycy9BdXRoL2djZW50ZXIuanMiXSwibmFtZXMiOlsiUGFyc2UiLCJyZXF1aXJlIiwiY3J5cHRvIiwiaHR0cHMiLCJ1cmwiLCJjYWNoZSIsInZlcmlmeVB1YmxpY0tleVVybCIsInB1YmxpY0tleVVybCIsInBhcnNlZFVybCIsInBhcnNlIiwicHJvdG9jb2wiLCJob3N0bmFtZVBhcnRzIiwiaG9zdG5hbWUiLCJzcGxpdCIsImxlbmd0aCIsImRvbWFpblBhcnRzIiwic2xpY2UiLCJkb21haW4iLCJqb2luIiwiY29udmVydFg1MDlDZXJ0VG9QRU0iLCJYNTA5Q2VydCIsInBlbVByZUZpeCIsInBlbVBvc3RGaXgiLCJiYXNlNjQiLCJjZXJ0Qm9keSIsIm1hdGNoIiwiUmVnRXhwIiwiZ2V0QXBwbGVDZXJ0aWZpY2F0ZSIsIkVycm9yIiwiT0JKRUNUX05PVF9GT1VORCIsIlByb21pc2UiLCJyZXNvbHZlIiwicmVqZWN0IiwiZ2V0IiwicmVzIiwiZGF0YSIsIm9uIiwiY2h1bmsiLCJ0b1N0cmluZyIsImNlcnQiLCJoZWFkZXJzIiwiZXhwaXJlIiwic2V0VGltZW91dCIsInBhcnNlSW50IiwiY29udmVydFRpbWVzdGFtcFRvQmlnRW5kaWFuIiwidGltZXN0YW1wIiwiYnVmZmVyIiwiQnVmZmVyIiwiYWxsb2MiLCJoaWdoIiwibG93Iiwid3JpdGVVSW50MzJCRSIsInZlcmlmeVNpZ25hdHVyZSIsInB1YmxpY0tleSIsImF1dGhEYXRhIiwidmVyaWZpZXIiLCJjcmVhdGVWZXJpZnkiLCJ1cGRhdGUiLCJwbGF5ZXJJZCIsImJ1bmRsZUlkIiwic2FsdCIsInZlcmlmeSIsInNpZ25hdHVyZSIsInZhbGlkYXRlQXV0aERhdGEiLCJpZCIsInZhbGlkYXRlQXBwSWQiLCJtb2R1bGUiLCJleHBvcnRzIl0sIm1hcHBpbmdzIjoiOztBQUFBOzs7Ozs7Ozs7Ozs7QUFhQSxNQUFNO0FBQUVBLEVBQUFBO0FBQUYsSUFBWUMsT0FBTyxDQUFDLFlBQUQs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QWdCSCxRQUFRLENBQUNNLElBQXpCLEVBQStCLFFBQS9COztBQUVBLE1BQUksQ0FBQ0wsUUFBUSxDQUFDTSxNQUFULENBQWdCUixTQUFoQixFQUEyQkMsUUFBUSxDQUFDUSxTQUFwQyxFQUErQyxRQUEvQyxDQUFMLEVBQStEO0FBQzdELFVBQU0sSUFBSTlELEtBQUssQ0FBQzRCLEtBQVYsQ0FDSjVCLEtBQUssQ0FBQzRCLEtBQU4sQ0FBWUMsZ0JBRFIsRUFFSix1Q0FGSSxDQUFOO0FBSUQ7QUFDRixDLENBRUQ7OztBQUNBLGVBQWVrQyxnQkFBZixDQUFnQ1QsUUFBaEMsRUFBMEM7QUFDeEMsTUFBSSxDQUFDQSxRQUFRLENBQUNVLEVBQWQsRUFBa0I7QUFDaEIsVUFBTSxJQUFJaEUsS0FBSyxDQUFDNEIsS0FBVixDQUNKNUIsS0FBSyxDQUFDNEIsS0FBTixDQUFZQyxnQkFEUixFQUVKLHlDQUZJLENBQU47QUFJRDs7QUFDRHlCLEVBQUFBLFFBQVEsQ0FBQ0ksUUFBVCxHQUFvQkosUUFBUSxDQUFDVSxFQUE3QjtBQUNBLFFBQU1YLFNBQVMsR0FBRyxNQUFNMUIsbUJBQW1CLENBQUMyQixRQUFRLENBQUMvQyxZQUFWLENBQTNDO0FBQ0EsU0FBTzZDLGVBQWUsQ0FBQ0MsU0FBRCxFQUFZQyxRQUFaLENBQXRCO0FBQ0QsQyxDQUVEOzs7QUFDQSxTQUFTVyxhQUFULEdBQXlCO0FBQ3ZCLFNBQU9uQyxPQUFPLENBQUNDLE9BQVIsRUFBUDtBQUNEOztBQUVEbUMsTUFBTSxDQUFDQyxPQUFQLEdBQWlCO0FBQ2ZGLEVBQUFBLGFBRGU7QUFFZkYsRUFBQUE7QUFGZSxDQUFqQiIsInNvdXJjZXNDb250ZW50IjpbIi8qIEFwcGxlIEdhbWUgQ2VudGVyIEF1dGhcbmh0dHBzOi8vZGV2ZWxvcGVyLmFwcGxlLmNvbS9kb2N1bWVudGF0aW9uL2dhbWVraXQvZ2tsb2NhbHBsYXllci8xNTE1NDA3LWdlbmVyYXRlaWRlbnRpdHl2ZXJpZmljYXRpb25zaWduI2Rpc2N1c3Npb25cblxuY29uc3QgYXV0aERhdGEgPSB7XG4gIHB1YmxpY0tleVVybDogJ2h0dHBzOi8vdmFsaWQuYXBwbGUuY29tL3B1YmxpYy90aW1lb3V0LmNlcicsXG4gIHRpbWVzdGFtcDogMTQ2MDk4MTQyMTMwMyxcbiAgc2lnbmF0dXJlOiAnUG9Ed2YzOURDTjQ2NEI0OWpKQ1UwZDlZMEonLFxuICBzYWx0OiAnc2FsdFNUPT0nLFxuICBidW5kbGVJZDogJ2NvbS52YWxpZC5hcHAnXG4gIGlkOiAncGxheWVySWQnLFxufTtcbiovXG5cbmNvbnN0IHsgUGFyc2UgfSA9IHJlcXVpcmUoJ3BhcnNlL25vZGUnKTtcbmNvbnN0IGNyeXB0byA9IHJlcXVpcmUoJ2NyeXB0bycpO1xuY29uc3QgaHR0cHMgPSByZXF1aXJlKCdodHRwcycpO1xuY29uc3QgdXJsID0gcmVxdWlyZSgndXJsJyk7XG5cbmNvbnN0IGNhY2hlID0ge307IC8vIChwdWJsaWNLZXkgLT4gY2VydCkgY2FjaGVcblxuZnVuY3Rpb24gdmVyaWZ5UHVibGljS2V5VXJsKHB1YmxpY0tleVVybCkge1xuICBjb25zdCBwYXJzZWRVcmwgPSB1cmwucGFyc2UocHVibGljS2V5VXJsKTtcbiAgaWYgKHBhcnNlZFVybC5wcm90b2NvbCAhPT0gJ2h0dHBzOicpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgY29uc3QgaG9zdG5hbWVQYXJ0cyA9IHBhcnNlZFVybC5ob3N0bmFtZS5zcGxpdCgnLicpO1xuICBjb25zdCBsZW5ndGggPSBob3N0bmFtZVBhcnRzLmxlbmd0aDtcbiAgY29uc3QgZG9tYWluUGFydHMgPSBob3N0bmFtZVBhcnRzLnNsaWNlKGxlbmd0aCAtIDIsIGxlbmd0aCk7XG4gIGNvbnN0IGRvbWFpbiA9IGRvbWFpblBhcnRzLmpvaW4oJy4nKTtcbiAgcmV0dXJuIGRvbWFpbiA9PT0gJ2FwcGxlLmNvbSc7XG59XG5cbmZ1bmN0aW9uIGNvbnZlcnRYNTA5Q2VydFRvUEVNKFg1MDlDZXJ0KSB7XG4gIGNvbnN0IHBlbVByZUZpeCA9ICctLS0tLUJFR0lOIENFUlRJRklDQVRFLS0tLS1cXG4nO1xuICBjb25zdCBwZW1Qb3N0Rml4ID0gJy0tLS0tRU5EIENFUlRJRklDQVRFLS0tLS0nO1xuXG4gIGNvbnN0IGJhc2U2NCA9IFg1MDlDZXJ0O1xuICBjb25zdCBjZXJ0Qm9keSA9IGJhc2U2NC5tYXRjaChuZXcgUmVnRXhwKCcuezAsNjR9JywgJ2cnKSkuam9pbignXFxuJyk7XG5cbiAgcmV0dXJuIHBlbVByZUZpeCArIGNlcnRCb2R5ICsgcGVtUG9zdEZpeDtcbn1cblxuZnVuY3Rpb24gZ2V0QXBwbGVDZXJ0aWZpY2F0ZShwdWJsaWNLZXlVcmwpIHtcbiAgaWYgKCF2ZXJpZnlQdWJsaWNLZXlVcmwocHVibGljS2V5VXJsKSkge1xuICAgIHRocm93IG5ldyBQYXJzZS5FcnJvcihcbiAgICAgIFBhcnNlLkVycm9yLk9CSkVDVF9OT1RfRk9VTkQsXG4gICAgICBgQXBwbGUgR2FtZSBDZW50ZXIgLSBpbnZhbGlkIHB1YmxpY0tleVVybDogJHtwdWJsaWNLZXlVcmx9YFxuICAgICk7XG4gIH1cbiAgaWYgKGNhY2hlW3B1YmxpY0tleVVybF0pIHtcbiAgICByZXR1cm4gY2FjaGVbcHVibGljS2V5VXJsXTtcbiAgfVxuICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgIGh0dHBzXG4gICAgICAuZ2V0KHB1YmxpY0tleVVybCwgcmVzID0+IHtcbiAgICAgICAgbGV0IGRhdGEgPSAnJztcbiAgICAgICAgcmVzLm9uKCdkYXRhJywgY2h1bmsgPT4ge1xuICAgICAgICAgIGRhdGEgKz0gY2h1bmsudG9TdHJpbmcoJ2Jhc2U2NCcpO1xuICAgICAgICB9KTtcbiAgICAgICAgcmVzLm9uKCdlbmQnLCAoKSA9PiB7XG4gICAgICAgICAgY29uc3QgY2VydCA9IGNvbnZlcnRYNTA5Q2VydFRvUEVNKGRhdGEpO1xuICAgICAgICAgIGlmIChyZXMuaGVhZGVyc1snY2FjaGUtY29udHJvbCddKSB7XG4gICAgICAgICAgICB2YXIgZXhwaXJlID0gcmVzLmhlYWRlcnNbJ2NhY2hlLWNvbnRyb2wnXS5tYXRjaCgvbWF4LWFnZT0oWzAtOV0rKS8pO1xuICAgICAgICAgICAgaWYgKGV4cGlyZSkge1xuICAgICAgICAgICAgICBjYWNoZVtwdWJsaWNLZXlVcmxdID0gY2VydDtcbiAgICAgICAgICAgICAgLy8gd2UnbGwgZXhwaXJlIHRoZSBjYWNoZSBlbnRyeSBsYXRlciwgYXMgcGVyIG1heC1hZ2VcbiAgICAgICAgICAgICAgc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgICAgICAgICAgZGVsZXRlIGNhY2hlW3B1YmxpY0tleVVybF07XG4gICAgICAgICAgICAgIH0sIHBhcnNlSW50KGV4cGlyZVsxXSwgMTApICogMTAwMCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIHJlc29sdmUoY2VydCk7XG4gICAgICAgIH0pO1xuICAgICAgfSlcbiAgICAgIC5vbignZXJyb3InLCByZWplY3QpO1xuICB9KTtcbn1cblxuZnVuY3Rpb24gY29udmVydFRpbWVzdGFtcFRvQmlnRW5kaWFuKHRpbWVzdGFtcCkge1xuICBjb25zdCBidWZmZXIgPSBCdWZmZXIuYWxsb2MoOCk7XG5cbiAgY29uc3QgaGlnaCA9IH5+KHRpbWVzdGFtcCAvIDB4ZmZmZmZmZmYpO1xuICBjb25zdCBsb3cgPSB0aW1lc3RhbXAgJSAoMHhmZmZmZmZmZiArIDB4MSk7XG5cbiAgYnVmZmVyLndyaXRlVUludDMyQkUocGFyc2VJbnQoaGlnaCwgMTApLCAwKTtcbiAgYnVmZmVyLndyaXRlVUludDMyQkUocGFyc2VJbnQobG93LCAxMCksIDQpO1xuXG4gIHJldHVybiBidWZmZXI7XG59XG5cbmZ1bmN0aW9uIHZlcmlmeVNpZ25hdHVyZShwdWJsaWNLZXksIGF1dGhEYXRhKSB7XG4gIGNvbnN0IHZlcmlmaWVyID0gY3J5cHRvLmNyZWF0ZVZlcmlmeSgnc2hhMjU2Jyk7XG4gIHZlcmlmaWVyLnVwZGF0ZShhdXRoRGF0YS5wbGF5ZXJJZCwgJ3V0ZjgnKTtcbiAgdmVyaWZpZXIudXBkYXRlKGF1dGhEYXRhLmJ1bmRsZUlkLCAndXRmOCcpO1xuICB2ZXJpZmllci51cGRhdGUoY29udmVydFRpbWVzdGFtcFRvQmlnRW5kaWFuKGF1dGhEYXRhLnRpbWVzdGFtcCkpO1xuICB2ZXJpZmllci51cGRhdGUoYXV0aERhdGEuc2FsdCwgJ2Jhc2U2NCcpO1xuXG4gIGlmICghdmVyaWZpZXIudmVyaWZ5KHB1YmxpY0tleSwgYXV0aERhdGEuc2lnbmF0dXJlLCAnYmFzZTY0JykpIHtcbiAgICB0aHJvdyBuZXcgUGFyc2UuRXJyb3IoXG4gICAgICBQYXJzZS5FcnJvci5PQkpFQ1RfTk9UX0ZPVU5ELFxuICAgICAgJ0FwcGxlIEdhbWUgQ2VudGVyIC0gaW52YWxpZCBzaWduYXR1cmUnXG4gICAgKTtcbiAgfVxufVxuXG4vLyBSZXR1cm5zIGEgcHJvbWlzZSB0aGF0IGZ1bGZpbGxzIGlmIHRoaXMgdXNlciBpZCBpcyB2YWxpZC5cbmFzeW5jIGZ1bmN0aW9uIHZhbGlkYXRlQXV0aERhdGEoYXV0aERhdGEpIHtcbiAgaWYgKCFhdXRoRGF0YS5pZCkge1xuICAgIHRocm93IG5ldyBQYXJzZS5FcnJvcihcbiAgICAgIFBhcnNlLkVycm9yLk9CSkVDVF9OT1RfRk9VTkQsXG4gICAgICAnQXBwbGUgR2FtZSBDZW50ZXIgLSBhdXRoRGF0YSBpZCBtaXNzaW5nJ1xuICAgICk7XG4gIH1cbiAgYXV0aERhdGEucGxheWVySWQgPSBhdXRoRGF0YS5pZDtcbiAgY29uc3QgcHVibGljS2V5ID0gYXdhaXQgZ2V0QXBwbGVDZXJ0aWZpY2F0ZShhdXRoRGF0YS5wdWJsaWNLZXlVcmwpO1xuICByZXR1cm4gdmVyaWZ5U2lnbmF0dXJlKHB1YmxpY0tleSwgYXV0aERhdGEpO1xufVxuXG4vLyBSZXR1cm5zIGEgcHJvbWlzZSB0aGF0IGZ1bGZpbGxzIGlmIHRoaXMgYXBwIGlkIGlzIHZhbGlkLlxuZnVuY3Rpb24gdmFsaWRhdGVBcHBJZCgpIHtcbiAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSgpO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgdmFsaWRhdGVBcHBJZCxcbiAgdmFsaWRhdGVBdXRoRGF0YSxcbn07XG4iXX0=