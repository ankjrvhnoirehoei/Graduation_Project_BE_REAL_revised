import { Injectable, InternalServerErrorException } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class ChatService {
  async ask(prompt: string): Promise<string> {
    const apiKey = process.env.OPENROUTER_API_KEY;

    try {
      const response = await axios.post(
        'https://openrouter.ai/api/v1/chat/completions',
        {
          model: 'nousresearch/deephermes-3-llama-3-8b-preview:free',
          messages: [{ role: 'user', content: prompt }],
        },
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
        },
      );

      const message = response.data?.choices?.[0]?.message?.content;
      if (!message) {
        throw new Error('Empty response from OpenRouter');
      }

      return message.trim();
    } catch (error) {
      console.error('OpenRouter error:', error?.response?.data || error.message);
      throw new InternalServerErrorException('Failed to fetch response from AI model');
    }
  }
}