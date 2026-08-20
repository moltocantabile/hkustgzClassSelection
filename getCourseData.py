import requests
import json
import base64
import hashlib

from Crypto.Cipher import AES
from Crypto.Util.Padding import unpad


TOKEN = “YOUR_TOKEN”

# URL = "https://pcc.hkust-gz.edu.cn/api/bdp/pg-course-catalog?size=1000&page=1" #Catalog
# URL = "https://sisn-service.hkust-gz.edu.cn/api/course/pageCourseSupermarketCourse" #SISN
# URL = "https://klms-service.hkust-gz.edu.cn/api/course/pageCourseSupermarketCourse" #KLMS


def aes_key():
    # JS:
    # CryptoJS.enc.Utf8.parse(md5(token))

    return hashlib.md5(
        TOKEN.encode()
    ).hexdigest().encode()



def decrypt(data):

    cipher = AES.new(
        aes_key(),
        AES.MODE_ECB
    )

    raw = base64.b64decode(data)

    plain = cipher.decrypt(raw)

    plain = unpad(
        plain,
        AES.block_size
    )

    return plain.decode("utf-8")



def get_course(term_id):

    headers = {
        "Authorization": TOKEN,
        "Content-Type":
            "application/json;charset=utf-8"
    }

    #Catalog API data is not encrypted
    '''catalog_payload = {
        "filter":{
            "and":[
                {"=":{"field":"term_code","value":term_id}},
                {"=":{"field":"career_type","value":"UG"}}
            ]
        }
    }'''
    
    payload = {
        "pageIndex": 1,
        "pageSize": 1000,
        "termId": term_id
    }


    r = requests.post(
        URL,
        headers=headers,
        json=payload
    )


    ret = r.json()


    if ret.get("isDataEncode") == "Y":

        text = decrypt(
            ret["data"]
        )

        return json.loads(text)

    return ret["data"]



if __name__ == "__main__":

    data = get_course(
        "TERM_ID" # e.g. 2610
    )


    with open(
        "filename.json",
        "w",
        encoding="utf-8"
    ) as f:

        json.dump(
            data,
            f,
            ensure_ascii=False,
            indent=2
        )


    print("done")