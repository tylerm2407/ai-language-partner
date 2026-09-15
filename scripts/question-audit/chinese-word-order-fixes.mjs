import { lessonRefs } from './lesson-refs.mjs';

// Authored word/phrase boundaries, not automatic character tokenization.
// Tuple: frozen ref, frozen key, English meaning, pipe-delimited tiles,
// optional alternative arrangements of those exact tiles.
// Complete 126-row draft. Wording and permitted orders need independent review.
export const chineseWordOrder = [
  // A2: everyday clauses, time/place order and basic comparisons.
  [566, '丈夫', 'My husband has two older sisters.', '我|丈夫|有|两个|姐姐。'],
  [578, '妻子', 'His wife is my best friend.', '他的妻子|是|我|最好的|朋友。'],
  [590, '男朋友', 'My boyfriend has just turned twenty this year.', '我的男朋友|今年|刚满|二十|岁。'],
  [602, '女朋友', 'My girlfriend moved to Beijing for work last year.', '我的女朋友|去年|搬到|北京|工作了。'],
  [614, '邻居', 'Our neighbors eat with their parents every Sunday.', '我们的|邻居|每个星期天|都|和父母|一起吃饭。'],
  [626, '婚礼', 'Their wedding will take place in Beijing next month.', '他们的|婚礼|下个月|在北京|举行。'],
  [638, '护士', 'The nurse asks me whether I have a bit of a headache.', '护士|问我|是不是|有点|头疼。'],
  [650, '牙医', 'I am going to see the dentist at nine tomorrow morning.', '我|明天上午|九点|要去|看牙医。'],
  [662, '压力', 'At the pharmacy, I want to ask whether stress can affect sleep.', '在药店，|我|想问问|压力|会不会|影响|睡眠。'],
  [674, '累', 'I feel very tired and want to rest quietly on my own.', '我|觉得|很累，|想|一个人|安静地|休息一下。', ['我|觉得|很累，|想|安静地|一个人|休息一下。']],
  [686, '休息', 'After the walk, I want to rest on the sofa for half an hour.', '散步以后，|我|想|在沙发上|休息|半个小时。'],
  [698, '饮食', 'The doctor introduced some healthy eating habits to me.', '医生|给我|介绍了|一些|健康的|饮食|习惯。'],
  [710, '洗', 'There is a washing machine in our bathroom for washing clothes.', '我们的|浴室里|有|一台|洗衣服用的|洗衣机。'],
  [722, '扫', 'I have to sweep the kitchen floor clean today.', '我|今天|要把|厨房的地|扫|干净。'],
  [734, '做饭', 'Our new apartment has a large kitchen, so cooking is very convenient.', '我们的|新公寓|有|一个大厨房，|做饭|很方便。'],
  [746, '租金', 'My neighbor pays the rent at the beginning of every month.', '我的|邻居|每个月|都在月初|付|租金。'],
  [758, '搬家', 'Because there is a leak in the apartment, we have to move.', '因为|公寓里|漏水，|我们|必须|搬家。'],
  [770, '公寓', 'This apartment has two bedrooms and a balcony.', '这套|公寓|有|两间卧室|和|一个阳台。'],
  [782, '害羞', 'Although I am a little shy, I am very happy to meet you.', '虽然|我|有点害羞，|但是|认识你|很高兴。'],
  [794, '勇敢', 'My younger brother is usually very brave, but today he is a little afraid.', '我的|弟弟|平时|很勇敢，|但是|今天|有点害怕。'],
  [806, '善良', 'Our teacher is very kind and often helps other people.', '我们的|老师|很善良，|经常|帮助|别人。'],
  [818, '大方', 'My friend is very generous and often shares her food with us.', '我的朋友|很大方，|经常|把她的食物|分给|我们。'],
  [830, '懒', 'When someone says he is lazy, he gets angry.', '别人|说他懒的时候，|他|就会|觉得|很生气。'],
  [842, '有耐心', 'My mother is very patient and explains every question to me carefully.', '我妈妈|很有耐心，|每个问题|都|给我|认真|解释。', ['我妈妈|很有耐心，|每个问题|都|认真|给我|解释。']],
  [854, '我买了', 'Yesterday I bought two books, one of which is for my older sister.', '昨天|我买了|两本书，|其中一本|是|给姐姐的。'],
  [866,"我旅行了","Last weekend I traveled for two days and took many photos.","上个周末|我旅行了|两天，|还|拍了|很多照片。"],
  [878, '我学习了', 'During my trip in Yunnan, I learned a few phrases in the local dialect and found it very interesting.', '在云南旅行的时候，|我学习了|几句|当地话，|觉得|很有意思。'],
  [890, '我玩了', 'When I was little, I once played with my older brother for a whole day.', '我小时候，|有一次|和哥哥|一起|玩了|一整天。'],
  [902, '我工作了', 'Last week I worked for six days, and today I can finally rest.', '上个星期|我工作了|六天，|今天|终于|能休息了。'],
  [914,"我说了","Yesterday I spoke with the teacher for ten minutes about that matter.","关于那件事，|我|昨天|跟老师|说了|十分钟。",["关于那件事，|我|跟老师|昨天|说了|十分钟。"]],
  [926,"我会旅行","Tomorrow I will travel to Shanghai with my friends.","明天|我|会|和朋友|一起|去上海旅行。",["明天|我|和朋友|会|一起|去上海旅行。"]],
  [938, '我会工作', 'During the next vacation, I will first work for two days and then visit my parents.', '下次放假的时候，|我|会|先|工作两天，|然后|去看父母。'],
  [950, '假期', 'My goal is to be able to have a one-month vacation next year.', '我的目标|是|明年|能有|一个月的|假期。'],
  [962, '目标', 'My goal today is to arrange a time to see the dentist next week.', '我今天的|目标|是|约好|下个星期|看牙医的时间。'],
  [974,"梦想","I believe your dream will come true next year.","我相信|你的|梦想|明年|就会|实现。",["我相信|明年|你的|梦想|就会|实现。"]],
  [986, '计划', 'We plan to travel to China together next summer.', '我们|计划|明年夏天|一起|去中国|旅行。'],
  [998, '更贵', 'This bicycle is more expensive than that one, but it is also lighter.', '这辆自行车|比|那辆|更贵，|但是|也更轻。'],
  [1010, '更高', 'My younger brother is taller than me, but he is younger than me.', '我弟弟|比我|更高，|但是|年纪|比我小。'],
  [1022, '更矮', 'This building is shorter than that one, but it has the largest garden.', '这栋楼|比那栋|更矮，|但是|有|最大的花园。'],
  [1034, '更快', 'This computer is more expensive, but it runs faster and its screen is clearer.', '这台电脑|更贵，|但是|运行得|更快，|屏幕|也更清楚。'],
  [1046,"更慢","I prefer to travel a little more slowly because that way I can see more scenery.","我|更喜欢|走得更慢一点，|因为|这样|可以|看到更多风景。",["我|更喜欢|走得更慢一点，|因为|可以|这样|看到更多风景。"]],
  [1058, '最好', 'Of these three hotels, this one has the best service.', '这三家酒店中，|这家|的|服务|最好。'],
  [1070, '礼物', 'At the Spring Festival, I prepare a small gift for my grandmother.', '春节的时候，|我|给奶奶|准备|一份|小礼物。'],
  [1082, '派对', 'At our family party, Grandma always makes her special cake.', '在我们家的派对上，|奶奶|总是|做|她拿手的|蛋糕。'],
  [1094, '庆祝', 'We celebrate this festival with music and traditional dances.', '我们|用|音乐|和传统舞蹈|庆祝|这个节日。'],
  [1106, '音乐', 'During the festival, there are music performances in the square every evening.', '节日期间，|每天晚上|广场上|都有|音乐|表演。', ['节日期间，|广场上|每天晚上|都有|音乐|表演。']],
  [1118, '跳舞', 'My younger sister likes dancing, so I want to give her a book about dance.', '我妹妹|喜欢跳舞，|所以|我想|送她|一本关于舞蹈的书。'],
  [1130, '节日', 'During this festival every year, we get together with our friends.', '每年|这个节日期间，|我们|都|和朋友们|聚一聚。'],
  // B1: linked reasons, reported information, narrative and hypothetical context.
  [1142, '社会', 'I think a fair society should offer everyone the same opportunities.', '我认为|一个公平的社会|应该|给|每个人|提供|同样的|机会。'],
  [1156,"政治","I understand your ideas, but I have a different view on this political issue.","我理解|你的想法，|但是|对|这个政治问题，|我|有|不同的看法。",["我理解|你的想法，|但是|我|对|这个政治问题，|有|不同的看法。"]],
  [1170, '经济', 'The newspaper says that as visitor numbers increase, tourism is becoming increasingly important to the local economy.', '报纸|说，|随着|游客人数的增加，|旅游业|对|当地经济|越来越重要。'],
  [1184, '辩论', 'We should debate housing issues so that more people understand the difficulties faced by young families.', '我们|应该|就|住房问题|展开|辩论，|让|更多人|了解|年轻家庭的|困难。'],
  [1198, '讨论', 'I am taking part in this discussion because the new road may affect life in our community.', '我参加|这次讨论，|是因为|新修的公路|可能会|影响|我们社区的|生活。'],
  [1212, '理由', 'My main reason for supporting this plan is that it can help more young people find work.', '我支持|这个计划的|主要理由|是，|它|能够|帮助|更多年轻人|找到工作。'],
  [1226, '雇用', 'At the interview, I want to ask when the company plans to hire new staff.', '在面试时，|我|想问问|公司|打算|什么时候|雇用|新的|工作人员。'],
  [1240, '解雇', 'The manager told us in an email that the company would not dismiss anyone next month.', '经理|在邮件里|告诉我们，|公司|下个月|不会|解雇|任何人。', ['经理|在邮件里|告诉我们，|下个月|公司|不会|解雇|任何人。']],
  [1254, '同事', 'At the meeting, my colleague explained why our team needs more time to complete this project.', '会议上，|我的同事|解释了|为什么|我们的团队|需要|更多时间|来完成|这个项目。', ['会议上，|我的同事|解释了|我们的团队|为什么|需要|更多时间|来完成|这个项目。']],
  [1268, '经理', 'I hope to become a manager in the future because I want to lead my own team in solving problems.', '我希望|将来|成为|一名经理，|因为|我想|带领|自己的团队|解决问题。'],
  [1282, '截止日期', 'We have to request that the deadline be moved back a week because the report still lacks some important data.', '我们|得|申请|把|截止日期|推迟一周，|因为|报告里|还缺少|一些重要数据。'],
  [1296, '项目', 'This project took more time than we had originally expected because several technical problems arose.', '这个项目|比|我们|原来预想的|花了|更多时间，|因为|出现了|几个|技术问题。'],
  [1310, '行李', 'Before booking the flight, you had better first confirm whether the fare includes the cost of checked luggage.', '订机票以前，|你|最好|先|确认|票价里|是否|包括|托运行李的|费用。'],
  [1324, '登机牌', 'Please have your boarding pass ready so that the staff at the gate can check it.', '请|准备好|您的|登机牌，|以便|登机口的工作人员|进行|检查。'],
  [1338, '延误', 'At check-in, I explained that our train had been delayed and we had therefore only just arrived at the hotel.', '办理入住手续时，|我|解释说，|我们的火车|延误了，|所以|直到现在|才|到达酒店。'],
  [1352, '取消', 'My younger sister suddenly became ill before departure, so we had no choice but to cancel the trip we had planned.', '出发前|我妹妹|突然|生病了，|我们|只好|取消|原来计划好的|旅行。', ['出发前|突然|我妹妹|生病了，|我们|只好|取消|原来计划好的|旅行。']],
  [1366, '冒险', 'Only after discovering that the last bus had already left did we realize that this adventure was harder than we had imagined.', '发现|最后一班公交车|已经|开走以后，|我们|才|意识到|这次冒险|比想象中|困难。'],
  [1380, '游客', 'The tourist asked us whether it was possible to walk to the museum in the city center without taking a vehicle.', '那位游客|问我们，|如果|不坐车，|能不能|步行|到|市中心的|博物馆。'],
  [1394, '濒危', 'Climate change is changing many animals’ habitats, putting some endangered species at greater risk.', '气候变化|正在|改变|许多动物的|栖息地，|使|一些|濒危物种|面临|更大的风险。'],
  [1408, '保护', 'Protecting this forest can not only preserve animal habitats but also allow future generations to see these wild animals.', '保护|这片森林|不仅|能|保存|动物的栖息地，|也能|让|后代|看到|这些野生动物。'],
  [1422,"能源","If we turn the heating down a little when leaving the room, we can save some energy in winter.","如果|离开房间时|把暖气|调低一点，|我们|就能|在冬天|节省|一些|能源。",["如果|离开房间时|把暖气|调低一点，|我们|在冬天|就能|节省|一些|能源。"]],
  [1436, '太阳能', 'Using solar energy can reduce air pollution caused by burning coal, but installing the equipment has a certain cost.', '使用|太阳能|可以|减少|燃烧煤炭|造成的|空气污染，|但|安装设备|需要|一定的|费用。'],
  [1450, '碳', 'We want to reduce carbon dioxide emissions, so we try to cycle rather than drive to work.', '我们|想|减少|二氧化碳的|排放，|所以|上班时|尽量|骑自行车|而不|开车。'],
  [1464, '野生动物', 'If people keep destroying forests, many wild animals will lose their original habitats.', '如果|人们|不断|破坏|森林，|许多野生动物|就会|失去|原来的|栖息地。'],
  [1478, '上传', 'Before uploading this video, you should first ask whether the other people agree to their images being made public.', '上传|这段视频|以前，|你|应该|先|问问|其他人|是否|同意|公开|他们的影像。'],
  [1492, '屏幕', 'Since I reduced the screen brightness, my phone has been able to last longer each day.', '自从|我|把|屏幕亮度|调低以后，|手机|每天|能用|更长的|时间了。'],
  [1506, '键盘', 'I prefer to write longer messages with a keyboard because I can type both quickly and accurately that way.', '我|更喜欢|用键盘|写|比较长的|消息，|因为|这样|打字|又快|又准确。'],
  [1520, '社交媒体', 'The pictures on social media will not open, so I plan to first check whether the network connection is working normally.', '社交媒体上的|图片|一直|打不开，|我|打算|先|检查|网络连接|是否|正常。'],
  [1534, '人工智能', 'In the future, artificial intelligence may be able to help doctors analyze more information, but important decisions will still need to be made by humans.', '将来，|人工智能|也许|能够|帮助医生|分析|更多资料，|但|重要决定|仍然|需要|人类来做。'],
  [1548, '机器人', 'This robot can answer simple questions, but when it encounters an unclear instruction, it still needs help from a person.', '这个机器人|能|回答|简单的问题，|但是|遇到|不清楚的指令时，|它|还需要|人来|帮助。'],
  [1562, '接下来', 'First we found an old map, and next we began looking for the house marked on it.', '我们|先|找到了一张|旧地图，|接下来|就|开始|寻找|地图上标出的|那座房子。'],
  [1576, '最后', 'We searched along the mountain path for several hours and finally reached the village before dark.', '我们|沿着山路|找了|几个小时，|最后|终于|在天黑以前|到达了|那个村子。'],
  [1590, '与此同时', 'Dad was cooking in the kitchen, and meanwhile the children were playing happily in the garden.', '爸爸|正在|厨房里|做饭，|与此同时，|孩子们|正|在花园里|开心地|玩耍。'],
  [1604, '人物', 'The character in the story was about to open the letter when he suddenly heard someone knocking outside the door.', '故事里的|人物|正要|打开|那封信，|突然|听见|有人|在门外|敲门。'],
  [1618, '情节', 'The plot of the novel takes place in a quiet little village where all the houses stand right beside a wide river.', '小说的|情节|发生在|一个|安静的|小村庄，|村里的房子|都|紧挨着|一条宽阔的河。'],
  [1632,"开头","At the beginning of the story, nobody knew why the stranger waited outside the train station every night.","故事的开头，|谁也|不知道|那个陌生人|为什么|每天晚上|都|在火车站前|等候。",["故事的开头，|谁也|不知道|为什么|那个陌生人|每天晚上|都|在火车站前|等候。","故事的开头，|谁也|不知道|每天晚上|那个陌生人|为什么|都|在火车站前|等候。"]],
  [1646, '也许', 'If it rains tomorrow, perhaps we will stay at home and watch a film together.', '如果|明天|下雨，|我们|也许|会|留在家里，|一起|看|一部电影。'],
  [1660, '想象', 'Imagine: if you lived by the sea, you could listen to the waves while taking a walk every morning.', '想象一下，|如果|你|住在|海边，|每天早晨|就能|一边|散步，|一边|听|海浪的声音。'],
  [1674, '假设', 'Suppose you lose your passport abroad; it is best to first contact the local police and your country’s embassy.', '假设|你|在国外|丢了|护照，|最好|先|联系|当地的警察|和|本国的大使馆。'],
  [1688, '代替', 'If someone could cover my shift tomorrow, I could go to the seaside with my friends.', '要是|明天|有人|能|代替|我|值班，|我|就可以|和朋友|一起|去海边了。'],
  [1702, '否则', 'I regret not following your advice at the time; otherwise I would not have missed that important interview.', '我后悔|当时|没有|听你的建议，|否则|就不会|错过|那次|重要的面试。'],
  [1716, '后悔', 'I really regret turning down that job; if I had accepted the opportunity then, I might be happier now.', '我|很后悔|拒绝了|那份工作，|要是|当时|接受了|那个机会，|现在|也许|会|更开心。'],
  [1730, '酷', 'In a formal request, rather than saying “This idea is cool,” it is better to write “I respectfully ask you to consider this proposal.”', '在正式的请求中，|与其|说|“这个主意很酷”，|不如|写|“恳请您|考虑|这个方案”。'],
  [1744, '太棒了', 'Great, you are finally here! Everyone was just worrying that you might miss this gathering.', '太棒了，|你|终于|来了！|大家|刚才|还在|担心|你|会不会|错过|这次聚会呢。'],
  [1758, '随便', 'When writing a work email, I use “Just contact me whenever it is convenient for you,” rather than simply writing “Whatever.”', '写工作邮件时，|我|会用|“您方便的时候|联系我就好”，|而不是|简单地|写|“随便”。'],
  [1772, '没关系', 'When the other person apologizes for being late on the phone, you can say, “It is all right, we have not started the meeting yet.”', '对方|在电话里|为迟到|道歉时，|你|可以|说|“没关系，|我们|还没|开始|开会呢”。'],
  [1786, '哥们', '“哥们” can be used to address a familiar male friend, but it is best not to address the other person that way in a formal interview.', '“哥们”|可以|用来|称呼|熟悉的男性朋友，|但是|在正式面试中|最好|不要|这样|称呼|对方。'],
  [1800, '正式', 'When writing an email to an unfamiliar client, I use relatively formal expressions to avoid seeming too casual.', '给|不熟悉的客户|写邮件时，|我|会|使用|比较正式的|表达，|避免|让人|觉得|过于随便。'],
  // B2: qualified arguments, professional purposes and literary interpretation.
  [1817,"真理","Although different people may understand truth differently, we still need to distinguish verifiable facts from unexamined personal judgments.","尽管|不同的人|可能|对|真理|有|不同的理解，|我们|仍然|需要|区分|可以验证的事实|和|未经检验的|个人判断。",["尽管|不同的人|对|真理|可能|有|不同的理解，|我们|仍然|需要|区分|可以验证的事实|和|未经检验的|个人判断。"]],
  [1831, '智慧', 'In my view, wisdom is not just accumulating knowledge; more important is being able to reflect on one’s beliefs and defer conclusions when evidence is insufficient.', '在我看来，|智慧|并不只是|积累知识，|更重要的是|能够|反思|自己的信念，|并在|证据不足时|暂缓|作出结论。'],
  [1845, '信仰', 'A person’s religious faith may give life meaning, but that personal experience does not automatically justify requiring others to accept the same values.', '一个人的|宗教信仰|可能|为生活|提供|意义，|但|这种个人体验|并不能|自动成为|要求他人|接受|同一套|价值观的|理由。'],
  [1859, '疑惑', 'As long as the available evidence still allows several reasonable explanations, retaining appropriate doubt does not mean refusing to think, but acknowledging the limits of the conclusion.', '只要|现有的证据|仍然|允许|多种合理的解释，|保留|适当的|疑惑|就|不意味着|拒绝|思考，|而是|承认|结论的|局限。'],
  [1873, '自由', 'If we emphasize only individual freedom while ignoring the effects of choices on others, it is difficult to discuss fully the relationship between freedom and responsibility.', '如果|只强调|个人自由，|却|忽视|选择对他人的影响，|我们|就很难|完整地|讨论|自由|与|责任|之间的|关系。'],
  [1887, '正义', 'Justice requires not only that rules treat everyone equally in form, but also that we carefully examine the different consequences those rules cause in practice.', '正义|不仅|要求|规则|在形式上|对所有人|一视同仁，|也要求|我们|认真|考察|这些规则|在现实中|造成的|不同后果。', ['正义|不仅|要求|规则|对所有人|在形式上|一视同仁，|也要求|我们|认真|考察|这些规则|在现实中|造成的|不同后果。']],
  [1901, '声明', 'Before supporting this public statement, we should check whether the data it cites are reliable rather than accepting its conclusion merely because its wording is powerful.', '在|支持|这份公开声明|之前，|我们|应当|核实|其中引用的数据|是否|可靠，|而不能|仅仅|因为|措辞有力|就|接受|它的结论。'],
  [1915, '谬误', 'Inferring directly from one successful case that a method works for everyone without examining failures is a fallacy of overgeneralization.', '从|一个成功的个案|直接|推断|某种方法|对所有人|都有效，|却不|考察|失败的情况，|这|是一种|以偏概全的|谬误。'],
  [1929, '修辞', 'Even if the speaker uses vivid rhetoric to move the audience, he still needs to explain how his proposal can be implemented within a limited budget.', '即使|演讲者|运用了|生动的修辞|来|打动听众，|他|仍然|需要|解释|自己的建议|如何|在|有限的预算内|得到|落实。', ['即使|演讲者|运用了|生动的修辞|来|打动听众，|他|仍然|需要|解释|自己的建议|在|有限的预算内|如何|得到|落实。']],
  [1943, '偏见', 'If a study is rejected solely because of its author’s background without analyzing its methods and evidence, that judgment may be influenced by bias.', '如果|仅仅|因为|作者的背景|就|否定|一项研究，|而不|分析|它的方法|和证据，|这种判断|就|可能|受到|偏见的影响。'],
  [1957, '论点', 'Before refuting your argument, I want first to confirm whether I have accurately understood its underlying assumptions and final conclusion.', '在|反驳|您的论点|之前，|我|想|先|确认|自己|是否|准确地|理解了|您所依据的|假设|和|最终结论。'],
  [1971, '说服', 'To persuade an audience with different views, we need not only to state our position clearly but also to respond carefully to the questions that concern them most.', '要想|说服|持不同意见的听众，|我们|不仅|要|清楚地|提出主张，|还需要|认真地|回应|他们|最关心的|疑问。'],
  [1985, '会议记录', 'The minutes of this meeting are attached; please carefully check the listed decisions before formally confirming them, and let us know promptly if anything is missing.', '随信附上|本次会议的|会议记录，|敬请|各位|在正式确认之前|仔细|核对|所列的决定，|如有遗漏|请|及时|告知。'],
  [1999,"委派","In this presentation, I will explain how to appoint suitable colleagues to handle different tasks while retaining responsibility for the project’s overall progress and quality.","在|这次报告中，|我|将|说明|如何|委派|合适的同事|负责|不同的任务，|同时|继续|对|项目整体进度|和|质量|负责。",["在|这次报告中，|我|将|说明|如何|委派|合适的同事|负责|不同的任务，|同时|继续|对|质量|和|项目整体进度|负责。"]],
  [2013, '效率', 'Provided that the new process really can improve efficiency without lowering the agreed quality standards, we are willing to make appropriate concessions on delivery time.', '只要|新流程|确实|能够|提高效率，|并且|不降低|已经约定的|质量标准，|我们|就愿意|在|交付时间上|作出|适当的|让步。'],
  [2027, '截止日期', 'We suggest moving the deadline back two weeks so that the assessment team can fully analyze potential risks before making a final decision instead of submitting a report hastily.', '我们建议|把截止日期|推迟两周，|以便|负责评估的团队|能够|在|作出最终决定之前|充分|分析|潜在的风险，|而不是|仓促|提交|报告。', ['我们建议|把截止日期|推迟两周，|以便|在|作出最终决定之前|负责评估的团队|能够|充分|分析|潜在的风险，|而不是|仓促|提交|报告。']],
  [2041,"谈判","After exchanging views at the conference, I hope to continue negotiations with you to explore further the areas in which we could establish long-term cooperation.","在会议上|交换意见之后，|我|希望|能与您|继续|谈判，|进一步|探讨|双方|在哪些领域|可以|建立|长期的|合作关系。",["在会议上|交换意见之后，|我|希望|能与您|继续|谈判，|进一步|探讨|双方|可以|在哪些领域|建立|长期的|合作关系。"]],
  [2055, '提案', 'Although this proposal is feasible in principle, we still need to clarify further the extra costs that might arise during implementation and who will bear the corresponding funding responsibility.', '尽管|这份提案|原则上|具有可行性，|我们|仍需|进一步|明确|实施过程中|可能产生的|额外费用，|以及|由谁|承担|相应的|资金责任。'],
  [2069, '情节转折', 'Through a strong contrast between light and dark colors, this painting suggests a plot twist in the story without directly explaining why the character suddenly changed their choice.', '这幅画|通过|明暗色彩的|强烈对比|暗示了|故事中的|情节转折，|却|没有|直接|说明|人物|为何|突然|改变了|自己的选择。'],
  [2083, '评论', 'In this review, I specifically point out that the novel’s contradictory memories force the reader to keep reassessing whether the narrator deserves trust.', '在这篇评论中，|我|特别|指出，|小说里|相互矛盾的|回忆|迫使读者|不断|重新|判断|叙述者|是否|值得|信任。'],
  [2097, '杰作', 'The film is regarded as a masterpiece not because it provides simple answers, but because it lets the audience see the complex circumstances behind the conflict.', '这部电影|之所以|被|视为|杰作，|并不是|因为|它|给出了|简单的答案，|而是|因为|它|让观众|看见了|冲突背后的|复杂处境。'],
  [2111,"灵感","The composer drew inspiration from traditional melodies and then gave those familiar sounds entirely new meaning through changing rhythms and unexpected harmonies.","作曲家|从|传统旋律中|获得了|灵感，|又|通过|变化的节奏|和|出人意料的和声|赋予|这些熟悉的声音|全新的|意义。",["作曲家|从|传统旋律中|获得了|灵感，|又|通过|出人意料的和声|和|变化的节奏|赋予|这些熟悉的声音|全新的|意义。"]],
  [2125, '小说', 'If I were to write a novel, I would have two characters take turns recounting the same past events, allowing the reader gradually to discover that their memories do not entirely agree.', '如果|我|要写|一部小说，|我|会|让|两个人物|轮流|讲述|同一段往事，|使读者|逐渐|发现|他们的记忆|并不|完全一致。'],
  [2139, '诗', 'The poem does not explicitly identify the source of its sense of loss, but leaves room for interpretation through recurring imagery, so different readers may reach different understandings.', '这首诗|并未|明确|交代|失落感的来源，|而是|通过|反复出现的|意象|保留了|解释的空间，|因此|不同的读者|可能|产生|不同的|理解。'],
  [2153, '说漏嘴', 'To avoid letting the secret slip early, he kept avoiding the topic of the birthday party and spoke only when all the guests were ready to surprise her.', '为了|不|提前|说漏嘴，|他|一直|避开|生日派对的话题，|直到|所有客人|都|准备好|给她|一个惊喜|才|开口。'],
  [2167,"一石二鸟","Taking advantage of a meeting downtown to drop off books at the library both saves a separate trip and returns the books on time: it really is killing two birds with one stone.","趁着|去市中心|参加会议的机会，|顺便|把|需要归还的书|带到图书馆，|既|少跑了|一趟路，|又|按时还了书，|真是|一石二鸟。"],
  [2181, '球在你手上', 'Since we have already put forward a concrete proposal, it is now your turn to make a decision; you still need to consider carefully whether to accept it.', '既然|我们|已经|提出了|具体的方案，|接下来|就|轮到你|作出决定，|是否|接受|还需要|由你|认真|考虑。'],
  [2195, '贪多嚼不烂', 'Taking on too many projects at once often leaves people unable to attend to everything; as the saying goes, do not bite off more than you can chew, so it is better to finish the work at hand first than hastily accept every request.', '同时|承担|太多项目|往往|会|让人|顾此失彼，|正所谓|贪多嚼不烂，|与其|仓促|答应所有请求，|不如|先|把|手头的工作|做好。'],
  [2209, '打破僵局', 'To break the deadlock, the moderator first asked both sides to list the points they had already agreed on and then gradually discuss the key issues on which they still disagreed.', '为了|打破僵局，|主持人|先|请|双方|列出|已经达成共识的事项，|然后|再|逐步|讨论|仍然|存在分歧的|关键问题。'],
  [2223, '一针见血', 'Although his comment was only a few short sentences, it incisively identified the proposal’s most fundamental problem, forcing everyone to reconsider their original assumptions.', '他的评论|虽然|只有|短短几句话，|却|一针见血地|指出了|这份提案|最根本的问题，|让|大家|不得不|重新|考虑|原来的|假设。'],
];

export function chineseWordOrderFixes(set) {
  const get = lessonRefs(set.snapshot, 'zh');
  const seen = new Set();
  for (const [n, oldKey, english, segmented, alternateSegments = []] of chineseWordOrder) {
    const { exercise, lesson, unit, course, ref } = get(n);
    if (seen.has(n)) throw new Error(`Duplicate word-order draft: ${ref}`);
    seen.add(n);
    const oldTiles = exercise.metadata?.tiles ?? exercise.correct_answer.split(' ');
    if (exercise.type !== 'sentence_construction' || exercise.correct_answer !== oldKey || oldTiles.length !== 1 || (exercise.metadata?.distractors ?? []).length) throw new Error(`Not an audited sole-answer bank: ${ref}`);
    const tiles = segmented.split('|');
    if (tiles.length < 5 || tiles.some(t => !t || /\s/.test(t))) throw new Error(`Invalid authored Chinese tile bank: ${ref}`);
    const answer = tiles.join('');
    const start = tiles[0], end = tiles.at(-1);
    const alternatives = alternateSegments.map(s => {
      const chunks = s.split('|');
      if (JSON.stringify([...chunks].sort()) !== JSON.stringify([...tiles].sort())) throw new Error(`Alternative changes tile inventory: ${ref}`);
      if (chunks[0] !== start || chunks.at(-1) !== end) throw new Error(`Alternative violates anchors: ${ref}`);
      return chunks.join('');
    });
    set.update('exercises', exercise.id, {
      prompt: `Arrange every word or phrase tile to translate: “${english}” Start with “${start}” and end with “${end}”.`,
      correct_answer: answer, accepted_answers: alternatives,
      metadata: { ...exercise.metadata, tiles, distractors: [], tile_joiner: '' },
    }, `${ref}: Replace the sole-answer bank with an individually authored ${course.cefr_level} sentence for ${unit.title} / ${lesson.title}. Every authored word/phrase tile is required and joins without spaces; fixed opening/ending leave at least three unanchored tiles. Independent linguistic/ordering review required.${n === 2181 ? ' The replacement practices the natural decision-making collocation 作出决定, preserving the functional meaning rather than requiring the isolated 球在你手上 calque. No conclusion is implied about unchanged related cards or other exercise rows.' : ''}`,
    n === 2181 ? ['https://dictionary.cambridge.org/te/dictionary/chinese-simplified-english/%E4%BD%9C%E5%87%BA'] : []);
  }
}
