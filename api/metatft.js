export default async function handler(req, res) {
  try {
    // 1. MetaTFT API 주소로 요청을 보냅니다.
    const response = await fetch('https://api-hc.metatft.com/tft-comps-api/comps_data?queue=1100', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    // 2. 성공적으로 받아온 JSON 데이터를 내 웹사이트로 전달합니다.
    res.status(200).json(data);
  } catch (error) {
    console.error('MetaTFT Fetch Error:', error);
    res.status(500).json({ error: '데이터를 가져오는데 실패했습니다.' });
  }
}