import OpenAI from 'openai';

// イベント種別のラベル
const EVENT_TYPE_LABELS = {
    'networking': 'ネットワーキング交流会',
    'seminar': 'セミナー・勉強会',
    'workshop': 'ワークショップ',
    'conference': 'カンファレンス',
    'online': 'オンラインイベント',
    'other': 'その他'
};

// Vercelサーバーレス関数
export default async function handler(req, res) {
    // CORS設定
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { eventTitle, eventDate, eventType, eventDetails } = req.body;

        // バリデーション
        if (!eventTitle || !eventDate || !eventDetails) {
            return res.status(400).json({ 
                error: 'イベント名、開催日、詳細は必須です' 
            });
        }

        // OpenAI APIキーの確認
        if (!process.env.OPENAI_API_KEY) {
            return res.status(500).json({ 
                error: 'OpenAI APIキーが設定されていません' 
            });
        }

        const eventTypeLabel = EVENT_TYPE_LABELS[eventType] || 'イベント';

        // イベント日付からタスクの日付を計算
        const eventDateObj = new Date(eventDate);
        const formatDate = (date) => {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        };

        const addDays = (date, days) => {
            const result = new Date(date);
            result.setDate(result.getDate() + days);
            return result;
        };

        // プロンプトを作成
        const prompt = `あなたはイベント企画・運営の専門家です。
以下の情報を元に、交流会の開催に必要なタスクリストを作成してください。

【イベント名】
${eventTitle}

【開催日】
${eventDate}

【イベント種別】
${eventTypeLabel}

【イベント詳細】
${eventDetails}

【要件】
以下のカテゴリごとにタスクを洗い出してください：

1. 集客・広報
   - メール文案作成
   - 招待状送付（メール）
   - リマインド通知配信（参加確定者向け）
   - 既存企業へのお声がけ
   - SNS・Webサイトでの告知
   - プレスリリース作成・配信（必要に応じて）
   など

2. 当日運営準備
   - 受付フロー設計＆台本作成
   - 名札・備品搬入リスト作成
   - 受付・誘導担当の役割分担
   - 音響／マイクチェック
   - プログラム進行リハーサル
   など

3. イベント実行
   - 受付開始
   - 開会挨拶・趣旨説明
   - 登壇者ピッチ
   - 交流タイム
   - クロージング・次回告知
   - 片付け・撤収
   など

4. フォローアップ
   - 参加者アンケート配信
   - 獲得アポ件数の集計
   - リードフォローリスト作成
   - 成果報告レポート作成
   - 次回振り返りMTG設定
   など

【出力形式】
JSON形式で以下の構造で出力してください：

{
  "tasks": [
    {
      "category": "カテゴリ名",
      "items": [
        {
          "name": "タスク名",
          "dueDate": "YYYY-MM-DD形式の日付",
          "status": "pending",
          "subtasks": ["サブタスク1", "サブタスク2"]
        }
      ]
    }
  ]
}

【注意事項】
- 各タスクには適切な期限日を設定してください（イベント日を基準に前後で設定）
- サブタスクは必要な場合のみ含めてください
- イベント詳細を考慮して、適切なタスクを追加してください
- 全てのタスクのstatusは"pending"に設定してください
- 日付はYYYY-MM-DD形式で出力してください

タスクリストを作成してください：`;

        // OpenAIクライアントの初期化
        const openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        });

        // OpenAI APIを呼び出し
        const completion = await openai.chat.completions.create({
            model: 'gpt-4',
            messages: [
                {
                    role: 'system',
                    content: 'あなたはイベント企画・運営の専門家です。提供された情報から、実践的で包括的なタスクリストをJSON形式で作成してください。'
                },
                {
                    role: 'user',
                    content: prompt
                }
            ],
            temperature: 0.7,
            max_tokens: 3000
        });

        const generatedText = completion.choices[0].message.content;

        // JSONを抽出
        let tasks;
        try {
            // JSONコードブロックから抽出
            const jsonMatch = generatedText.match(/```json\n([\s\S]*?)\n```/) || 
                            generatedText.match(/```\n([\s\S]*?)\n```/) ||
                            generatedText.match(/\{[\s\S]*\}/);
            
            if (jsonMatch) {
                const jsonText = jsonMatch[1] || jsonMatch[0];
                tasks = JSON.parse(jsonText);
            } else {
                // JSONが見つからない場合は、テンプレートベースで生成
                throw new Error('JSONが見つかりません');
            }
        } catch (parseError) {
            console.warn('JSON解析エラー、テンプレートベースで生成:', parseError);
            // フォールバック: テンプレートベースのタスクを生成
            tasks = generateTemplateTasks(eventDateObj, formatDate, addDays);
        }

        // タスクの日付を検証・修正
        tasks.tasks = tasks.tasks || tasks;
        if (Array.isArray(tasks.tasks)) {
            tasks.tasks.forEach(category => {
                if (category.items) {
                    category.items.forEach(item => {
                        // 日付形式を検証
                        if (!item.dueDate || !/^\d{4}-\d{2}-\d{2}$/.test(item.dueDate)) {
                            // デフォルト日付を設定
                            item.dueDate = formatDate(eventDateObj);
                        }
                        // statusを確実に設定
                        if (!item.status) {
                            item.status = 'pending';
                        }
                    });
                }
            });
        }

        res.json({
            tasks: tasks.tasks || tasks
        });

    } catch (error) {
        console.error('タスク生成エラー:', error);
        res.status(500).json({ 
            error: 'タスクリストの生成に失敗しました',
            message: error.message 
        });
    }
}

// テンプレートベースのタスク生成（フォールバック用）
function generateTemplateTasks(eventDateObj, formatDate, addDays) {
    return {
        tasks: [
            {
                category: '集客・広報',
                items: [
                    {
                        name: 'メール文案作成',
                        dueDate: formatDate(addDays(eventDateObj, -60)),
                        status: 'pending',
                        subtasks: [
                            '招待状送付（メール）',
                            'リマインド通知配信（参加確定者向け）'
                        ]
                    },
                    {
                        name: '既存企業へのお声がけ',
                        dueDate: formatDate(addDays(eventDateObj, -60)),
                        status: 'pending'
                    },
                    {
                        name: 'SNS・Webサイトでの告知',
                        dueDate: formatDate(addDays(eventDateObj, -50)),
                        status: 'pending'
                    }
                ]
            },
            {
                category: '当日運営準備',
                items: [
                    {
                        name: '受付フロー設計＆台本作成',
                        dueDate: formatDate(addDays(eventDateObj, -43)),
                        status: 'pending'
                    },
                    {
                        name: '名札・備品搬入リスト作成',
                        dueDate: formatDate(addDays(eventDateObj, -14)),
                        status: 'pending'
                    },
                    {
                        name: '受付・誘導担当の役割分担',
                        dueDate: formatDate(addDays(eventDateObj, -14)),
                        status: 'pending'
                    },
                    {
                        name: '音響／マイクチェック',
                        dueDate: formatDate(addDays(eventDateObj, -14)),
                        status: 'pending'
                    },
                    {
                        name: 'プログラム進行リハーサル',
                        dueDate: formatDate(addDays(eventDateObj, -14)),
                        status: 'pending'
                    }
                ]
            },
            {
                category: 'イベント実行',
                items: [
                    {
                        name: '受付開始',
                        dueDate: formatDate(eventDateObj),
                        status: 'pending',
                        time: '18:30～'
                    },
                    {
                        name: '開会挨拶・趣旨説明',
                        dueDate: formatDate(eventDateObj),
                        status: 'pending',
                        time: '19:00'
                    },
                    {
                        name: '登壇者によるピッチ',
                        dueDate: formatDate(eventDateObj),
                        status: 'pending',
                        time: '19:10～19:30'
                    },
                    {
                        name: '交流タイム',
                        dueDate: formatDate(eventDateObj),
                        status: 'pending',
                        time: '19:30～21:00'
                    },
                    {
                        name: 'クロージング・次回告知',
                        dueDate: formatDate(eventDateObj),
                        status: 'pending',
                        time: '21:00'
                    },
                    {
                        name: '片付け・撤収',
                        dueDate: formatDate(eventDateObj),
                        status: 'pending',
                        time: '21:00～21:30'
                    }
                ]
            },
            {
                category: 'フォローアップ',
                items: [
                    {
                        name: '参加者アンケート配信',
                        dueDate: formatDate(addDays(eventDateObj, 1)),
                        status: 'pending'
                    },
                    {
                        name: '獲得アポ件数の集計',
                        dueDate: formatDate(eventDateObj),
                        status: 'pending'
                    },
                    {
                        name: 'リードフォローリスト作成',
                        dueDate: formatDate(eventDateObj),
                        status: 'pending'
                    },
                    {
                        name: '成果報告レポート作成',
                        dueDate: formatDate(eventDateObj),
                        status: 'pending'
                    },
                    {
                        name: '次回振り返りMTG設定',
                        dueDate: formatDate(eventDateObj),
                        status: 'pending'
                    }
                ]
            }
        ]
    };
}

