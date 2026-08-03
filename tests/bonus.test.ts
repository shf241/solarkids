import { describe, expect, it } from 'vitest';
import { answerAstronomyQuestion } from '../src/bonus/astronomyAdvisor';
import { LearningRoomClient } from '../src/bonus/learningRoom';

describe('SolarKids bonus features', () => {
  it('answers a Chinese astronomy question with the matching topic', () => {
    const answer = answerAstronomyQuestion('为什么彗星接近太阳会有长长的尾巴？');

    expect(answer.topic).toBe('哈雷彗星');
    expect(answer.answer).toContain('彗尾');
  });

  it('answers an English question without a network dependency', () => {
    const answer = answerAstronomyQuestion('What is a solar eclipse?', 'en');

    expect(answer.topic).toBe('Eclipses');
    expect(answer.answer).toContain('Moon');
  });

  it('provides a friendly fallback for unknown questions', () => {
    const answer = answerAstronomyQuestion('Can spaceships play football?');

    expect(answer.answer).toContain('离线知识卡片');
  });

  it('normalizes a room and remains usable when the optional server is offline', () => {
    const client = new LearningRoomClient({ websocketUrl: 'ws://127.0.0.1:1' });
    const snapshots: string[] = [];
    client.subscribe(snapshot => snapshots.push(`${snapshot.status}:${snapshot.room}`));

    expect(() => client.connect(' 星轨 房间 ', '小朋友')).not.toThrow();
    expect(client.getSnapshot().room).toBe('STAR-ROOM');
    client.publish('点击了地球');
    client.disconnect();

    expect(snapshots.some(value => value.includes('STAR-ROOM'))).toBe(true);
    client.dispose();
  });
});
