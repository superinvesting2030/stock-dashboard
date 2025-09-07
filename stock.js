export default async function handler(req, res) {
    // CORS 허용 (모든 도메인에서 접근 가능)
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    
    // OPTIONS 요청 처리
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    // 종목코드 가져오기
    const { code } = req.query;
    
    if (!code) {
        res.status(400).json({ error: '종목코드가 필요합니다' });
        return;
    }

    try {
        // Yahoo Finance에서 한국 주식 데이터 가져오기
        // 한국 주식은 .KS (코스피) 또는 .KQ (코스닥) 붙이기
        const symbol = `${code}.KS`;
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1mo`;
        
        const response = await fetch(url);
        const data = await response.json();
        
        if (!data.chart || !data.chart.result || data.chart.result.length === 0) {
            throw new Error('데이터를 찾을 수 없습니다');
        }

        const result = data.chart.result[0];
        const meta = result.meta;
        const quotes = result.indicators.quote[0];
        const timestamps = result.timestamp;

        // 차트 데이터 생성
        const chartData = [];
        for (let i = 0; i < timestamps.length; i++) {
            if (quotes.open[i] && quotes.close[i]) {
                chartData.push({
                    time: new Date(timestamps[i] * 1000).toISOString().split('T')[0],
                    open: quotes.open[i],
                    high: quotes.high[i],
                    low: quotes.low[i],
                    close: quotes.close[i]
                });
            }
        }

        // 현재가 정보
        const currentPrice = meta.regularMarketPrice;
        const previousClose = meta.previousClose || meta.chartPreviousClose;
        const change = currentPrice - previousClose;
        const changePercent = ((change / previousClose) * 100).toFixed(2);
        const volume = quotes.volume[quotes.volume.length - 1] || 0;

        // 응답 데이터
        const responseData = {
            symbol: code,
            name: getStockName(code),
            price: currentPrice,
            previousClose: previousClose,
            change: change,
            changePercent: changePercent,
            volume: volume,
            tradingValue: currentPrice * volume,
            high: meta.regularMarketDayHigh || meta.dayHigh,
            low: meta.regularMarketDayLow || meta.dayLow,
            chartData: chartData
        };

        res.status(200).json(responseData);

    } catch (error) {
        console.error('Error fetching stock data:', error);
        res.status(500).json({ 
            error: '데이터를 가져오는데 실패했습니다',
            details: error.message 
        });
    }
}

// 종목코드로 회사명 반환
function getStockName(code) {
    const stocks = {
        '005930': '삼성전자',
        '000660': 'SK하이닉스',
        '035420': 'NAVER',
        '035720': '카카오',
        '005380': '현대차',
        '051910': 'LG화학',
        '006400': '삼성SDI',
        '068270': '셀트리온',
        '105560': 'KB금융',
        '055550': '신한지주'
    };
    return stocks[code] || code;
}
