<?php

namespace InertiaUI\Notifications\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Carbon;

/**
 * The request that snoozes one of the signed-in user's notifications.
 */
class SnoozeNotificationRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, array<int, mixed>>
     */
    public function rules(): array
    {
        return [
            'until' => ['required', 'date', 'after:now'],
        ];
    }

    /**
     * Get the time that the notification is snoozed until.
     */
    public function until(): Carbon
    {
        return Carbon::parse($this->validated('until'));
    }
}
