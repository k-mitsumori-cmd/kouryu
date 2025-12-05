import OpenAI from 'openai';

// タスクタイプに応じた参考資料を生成
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
        const { taskName, category, eventTitle, eventDate, eventDetails } = req.body;

        // バリデーション
        if (!taskName || !eventTitle || !eventDetails) {
            return res.status(400).json({ 
                error: 'タスク名、イベント名、イベント詳細は必須です' 
            });
        }

        // OpenAI APIキーの確認
        if (!process.env.OPENAI_API_KEY) {
            // APIキーがない場合はテンプレートベースで返す
            const template = getTemplateForTask(taskName, category, eventTitle, eventDate);
            return res.json(template);
        }

        // OpenAIクライアントの初期化
        const openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        });

        // タスクタイプに応じたプロンプトを作成
        const prompt = createPromptForTask(taskName, category, eventTitle, eventDate, eventDetails);

        // OpenAI APIを呼び出し
        const completion = await openai.chat.completions.create({
            model: 'gpt-4',
            messages: [
                {
                    role: 'system',
                    content: 'あなたはイベント企画・運営の専門家です。提供されたタスクに関する実践的な参考資料、テンプレート、注意点を詳しく説明してください。'
                },
                {
                    role: 'user',
                    content: prompt
                }
            ],
            temperature: 0.7,
            max_tokens: 2000
        });

        const generatedText = completion.choices[0].message.content;

        // 生成されたテキストを構造化
        const result = parseGeneratedContent(generatedText, taskName, category);

        res.json(result);

    } catch (error) {
        console.error('参考資料生成エラー:', error);
        // エラー時はテンプレートを返す
        const template = getTemplateForTask(
            req.body.taskName, 
            req.body.category, 
            req.body.eventTitle, 
            req.body.eventDate
        );
        res.json(template);
    }
}

// タスクタイプに応じたプロンプトを作成
function createPromptForTask(taskName, category, eventTitle, eventDate, eventDetails) {
    const basePrompt = `以下のタスクに関する参考資料を作成してください。

【タスク名】
${taskName}

【カテゴリ】
${category}

【イベント情報】
- イベント名: ${eventTitle}
- 開催日: ${eventDate}
- 詳細: ${eventDetails}

【作成してほしい内容】
1. 参考テンプレート・例文（実際に使用できる形式で）
2. チェックリスト（必要な項目）
3. 注意点・ポイント
4. 追加で検討すべき項目

【出力形式】
以下の形式で出力してください：

## 参考テンプレート

（実際に使用できるテンプレートを記載）

## チェックリスト

（チェック項目を箇条書きで）

## 注意点

（重要なポイントを箇条書きで）

## 追加項目

（必要に応じて検討すべき項目を箇条書きで）`;

    // タスクタイプに応じて詳細な指示を追加
    if (taskName.includes('メール') || taskName.includes('招待状')) {
        return basePrompt + `

【特に注意してほしい点】
- メールの件名は明確で魅力的に
- イベントの価値提案を明確に
- 参加方法を分かりやすく
- 期限や締切日を明確に記載
- キャンセルポリシーも記載`;
    }

    if (taskName.includes('リマインド')) {
        return basePrompt + `

【特に注意してほしい点】
- イベント前日または数日前に送信
- 会場情報、時間、持ち物などを再確認
- 参加への期待感を高める内容
- 直前キャンセルの連絡方法も記載`;
    }

    if (taskName.includes('受付') || taskName.includes('台本')) {
        return basePrompt + `

【特に注意してほしい点】
- 受付の流れを明確に（来場から着席まで）
- 担当者の役割分担を明確に
- よくある質問への対応方法
- トラブル時の対応フロー
- 来場者への案内文も含める`;
    }

    if (taskName.includes('アンケート')) {
        return basePrompt + `

【特に注意してほしい点】
- イベント直後（記憶が新鮮なうち）に送信
- 質問項目は簡潔に（5-10問程度）
- 満足度、改善点、次回参加意向を確認
- 選択肢と自由記述を組み合わせ`;
    }

    return basePrompt;
}

// 生成されたコンテンツを構造化
function parseGeneratedContent(text, taskName, category) {
    const sections = {
        template: '',
        checklist: [],
        notes: [],
        additionalItems: []
    };

    // セクションごとに抽出
    const templateMatch = text.match(/## 参考テンプレート\s*\n([\s\S]*?)(?=## |$)/);
    if (templateMatch) {
        sections.template = templateMatch[1].trim();
    }

    const checklistMatch = text.match(/## チェックリスト\s*\n([\s\S]*?)(?=## |$)/);
    if (checklistMatch) {
        sections.checklist = checklistMatch[1]
            .split('\n')
            .filter(line => line.trim() && (line.includes('-') || line.includes('・') || line.includes('✓')))
            .map(line => line.replace(/^[-・✓\s]+/, '').trim())
            .filter(item => item.length > 0);
    }

    const notesMatch = text.match(/## 注意点\s*\n([\s\S]*?)(?=## |$)/);
    if (notesMatch) {
        sections.notes = notesMatch[1]
            .split('\n')
            .filter(line => line.trim() && (line.includes('-') || line.includes('・')))
            .map(line => line.replace(/^[-・\s]+/, '').trim())
            .filter(item => item.length > 0);
    }

    const additionalMatch = text.match(/## 追加項目\s*\n([\s\S]*?)(?=## |$)/);
    if (additionalMatch) {
        sections.additionalItems = additionalMatch[1]
            .split('\n')
            .filter(line => line.trim() && (line.includes('-') || line.includes('・')))
            .map(line => line.replace(/^[-・\s]+/, '').trim())
            .filter(item => item.length > 0);
    }

    // パースがうまくいかない場合は全文をテンプレートとして使用
    if (!sections.template && !sections.checklist.length) {
        sections.template = text;
    }

    return sections;
}

// テンプレートベースの参考資料（フォールバック用）
function getTemplateForTask(taskName, category, eventTitle, eventDate) {
    const templates = {
        'メール文案作成': {
            template: `件名: 【ご案内】${eventTitle}へのご招待

${eventTitle}について

いつもお世話になっております。

この度、下記の通り${eventTitle}を開催いたします。
ぜひご参加いただけますと幸いです。

【イベント概要】
- 日時: ${eventDate}
- 場所: [会場名を記載]
- 定員: [人数を記載]
- 参加費: [金額を記載]

【イベント内容】
[イベントの詳細内容を記載]

【お申し込み方法】
[申し込み方法を記載]

【お問い合わせ】
[問い合わせ先を記載]

皆様のご参加をお待ちしております。`,
            checklist: [
                '件名が明確で魅力的か',
                'イベントの日時・場所が正確か',
                '参加方法が分かりやすいか',
                '締切日を明記しているか',
                '問い合わせ先が明記されているか'
            ],
            notes: [
                'メールはイベントの2週間前までに送信',
                '返信期限を明確に設定',
                'キャンセルポリシーも記載する',
                '参加者への期待を高める内容にする'
            ],
            additionalItems: [
                'リマインドメールの送信スケジュール',
                '参加確定メールの送信',
                'キャンセル待ちリストの管理'
            ]
        },
        '招待状送付（メール）': {
            template: `件名: ${eventTitle} ご招待状

${eventTitle}へのご招待

[宛先名] 様

いつもお世話になっております。

この度、${eventTitle}を開催することとなりました。
ぜひご参加いただけますと幸いです。

【イベント詳細】
- 日時: ${eventDate}
- 場所: [会場名]
- 参加費: [金額]

[詳細な説明を記載]

ご多忙中恐れ入りますが、ご参加いただけますようお願い申し上げます。

[送信者名]`,
            checklist: [
                '宛先が正しいか',
                '日時・場所が正確か',
                '参加方法が明確か',
                '返信期限を明記しているか'
            ],
            notes: [
                '個人宛ての場合は個人名を記載',
                '会社宛ての場合は部署名まで記載',
                '返信期限は開催日の1週間前を推奨'
            ],
            additionalItems: [
                '招待状のデザイン',
                'メール以外の送付方法の検討'
            ]
        },
        'リマインド通知配信（参加確定者向け）': {
            template: `件名: 【リマインド】${eventTitle} 明日開催です！

${eventTitle} リマインド

[参加者名] 様

${eventTitle}にご参加いただき、ありがとうございます。

明日、${eventDate}にイベントを開催いたします。
以下の情報をご確認ください。

【開催情報】
- 日時: ${eventDate} [開始時間]
- 場所: [会場名]
- 住所: [住所]
- アクセス: [アクセス方法]

【当日の持ち物】
- [持ち物1]
- [持ち物2]

【ご注意事項】
- 会場への到着は開始時刻の15分前を推奨
- キャンセルの場合は[連絡先]までご連絡ください

皆様にお会いできることを楽しみにしております。

[主催者名]`,
            checklist: [
                '会場情報が正確か',
                'アクセス方法が分かりやすいか',
                '開始時刻を明記しているか',
                '連絡先が記載されているか'
            ],
            notes: [
                'イベント前日または2日前に送信',
                '会場情報は詳細に記載',
                'アクセス方法は複数の手段を記載',
                'キャンセル連絡先も明記'
            ],
            additionalItems: [
                '当日の天気情報',
                '駐車場情報',
                '最寄り駅からの案内図'
            ]
        },
        '受付フロー設計＆台本作成': {
            template: `【受付フロー】

1. 来場者の到着
   → スタッフ: 「いらっしゃいませ。${eventTitle}へのご参加ありがとうございます。」
   
2. 名札の確認・配布
   → スタッフ: 「お名前を教えていただけますか？」
   → 名簿で確認後、名札を渡す
   
3. 参加費の確認（有料の場合）
   → スタッフ: 「参加費はお支払い済みでしょうか？」
   
4. 会場への案内
   → スタッフ: 「会場はこちらになります。名札をお付けください。」
   → 会場入口を指し示す

【よくある質問への対応】

Q: 名札が見つかりません
A: 「お名前を確認いたしますので、少しお待ちください。」→ 名簿で確認

Q: 参加費はどこで支払いますか？
A: 「受付でお支払いいただけます。現金またはクレジットカードがご利用いただけます。」

Q: 会場はどこですか？
A: 「[会場名]の[フロア名]になります。こちらから[方向]にお進みください。」`,
            checklist: [
                '受付担当者の役割分担が明確か',
                '名札・名簿の準備',
                '参加費の支払い方法の確認',
                '会場への案内方法の決定',
                'よくある質問への対応方法'
            ],
            notes: [
                '受付は開始時刻の30分前から開始',
                '複数の受付カウンターを準備（来場者が多い場合）',
                '名札は事前に準備しておく',
                '混雑時の対応も想定する'
            ],
            additionalItems: [
                '受付担当者のシフト表',
                '名札のデザイン',
                '受付カウンターのレイアウト',
                'キャンセル待ちの対応'
            ]
        },
        '参加者アンケート配信': {
            template: `件名: ${eventTitle} アンケートのお願い

アンケートのお願い

[参加者名] 様

${eventTitle}にご参加いただき、ありがとうございました。

より良いイベント運営のため、アンケートにご協力いただけますと幸いです。
所要時間は約3分です。

【アンケートURL】
[URLを記載]

【アンケート内容】
1. 今回のイベントの満足度
2. 良かった点
3. 改善してほしい点
4. 次回も参加したいか
5. その他ご意見・ご要望

ご協力のほど、よろしくお願いいたします。

[主催者名]`,
            checklist: [
                'アンケートの質問項目が明確か',
                '所要時間が明記されているか',
                '回答期限を設定しているか',
                '謝辞が含まれているか'
            ],
            notes: [
                'イベント終了後、なるべく早く送信（24時間以内推奨）',
                '質問は5-10問程度に絞る',
                '選択肢と自由記述を組み合わせる',
                '回答期限は1週間後を推奨'
            ],
            additionalItems: [
                '謝礼や特典の検討',
                'アンケート結果の集計方法',
                '改善点の反映計画'
            ]
        }
    };

    // タスク名に一致するテンプレートを検索
    for (const [key, value] of Object.entries(templates)) {
        if (taskName.includes(key) || key.includes(taskName)) {
            return value;
        }
    }

    // デフォルトテンプレート
    return {
        template: `${taskName}に関する参考資料

【概要】
${taskName}について、以下の点を確認・準備してください。

【チェックリスト】
- [ ] 必要な資料・情報の準備
- [ ] 担当者の決定
- [ ] スケジュールの確認
- [ ] 関係者への連絡`,
        checklist: [
            '必要な資料・情報の準備',
            '担当者の決定',
            'スケジュールの確認'
        ],
        notes: [
            '事前に十分な準備時間を確保する',
            '関係者とコミュニケーションを密に取る'
        ],
        additionalItems: [
            '追加で検討すべき項目があれば記載'
        ]
    };
}

